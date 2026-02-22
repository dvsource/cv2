#!/bin/bash
# =============================================================
# CV Editor — EC2 Setup (Amazon Linux 2023)
#
#   nginx (port 80)
#     ├─ /         → serves web/dist/ directly (static files)
#     └─ /api/*    → proxies to gunicorn :5000
#
#   gunicorn (port 5000, localhost only)
#     └─ Flask app (server:app)
#
# Usage: bash setup-ec2.sh
# =============================================================

set -e

APP_DIR="/home/ec2-user/cv2"

echo "=== 1/7  System packages ==="
sudo dnf update -y
sudo dnf install -y python3 python3-pip nodejs npm git nginx

echo "=== 2/7  Fonts ==="
sudo dnf install -y google-noto-sans-fonts google-noto-sans-mono-fonts
sudo mkdir -p /usr/share/fonts/noto
for f in NotoSans-Regular NotoSans-Bold NotoSans-Italic NotoSans-BoldItalic; do
  src=$(find /usr/share/fonts -name "${f}.ttf" 2>/dev/null | head -1)
  if [ -n "$src" ]; then
    sudo cp "$src" /usr/share/fonts/noto/
    echo "  OK  $f.ttf"
  else
    echo "  MISSING  $f.ttf"
  fi
done
src=$(find /usr/share/fonts -name "NotoSansMono-Bold.ttf" 2>/dev/null | head -1)
if [ -n "$src" ]; then
  sudo cp "$src" /usr/share/fonts/noto/
  echo "  OK  NotoSansMono-Bold.ttf"
else
  echo "  MISSING  NotoSansMono-Bold.ttf"
fi

echo "=== 3/7  Python dependencies ==="
cd "$APP_DIR"
pip3 install --user -r requirements.txt

echo "=== 4/7  Build React frontend ==="
cd "$APP_DIR/web"
npm ci
npm run build
cd "$APP_DIR"

echo "=== 5/7  Configure nginx ==="
sudo tee /etc/nginx/conf.d/cv-editor.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Serve React static files directly — fast, no Python involved
    root /home/ec2-user/cv2/web/dist;
    index index.html;

    # API requests → gunicorn
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # PDF responses can be large, increase timeout
        proxy_read_timeout 30s;
        client_max_body_size 5M;
    }

    # SPA fallback — any non-file route serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Remove the default server block so it doesn't conflict on port 80
sudo sed -i '/^[[:space:]]*listen[[:space:]]*80;/,/^[[:space:]]*}/s/listen[[:space:]]*80/listen 8080/' /etc/nginx/nginx.conf 2>/dev/null || true

# Let nginx read files from ec2-user's home
sudo chmod 711 /home/ec2-user

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "=== 6/7  Gunicorn systemd service ==="
sudo tee /etc/systemd/system/cv-editor.service > /dev/null << EOF
[Unit]
Description=CV Editor (gunicorn)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR
ExecStart=/home/ec2-user/.local/bin/gunicorn server:app -b 127.0.0.1:5000 -w 2 --timeout 30
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cv-editor
sudo systemctl start cv-editor

echo "=== 7/7  Verify ==="
sleep 2
echo ""
if sudo systemctl is-active --quiet cv-editor; then
  echo "  gunicorn: RUNNING"
else
  echo "  gunicorn: FAILED — check: sudo journalctl -u cv-editor -n 20"
fi
if sudo systemctl is-active --quiet nginx; then
  echo "  nginx:    RUNNING"
else
  echo "  nginx:    FAILED — check: sudo journalctl -u nginx -n 20"
fi

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<your-ip>")
echo ""
echo "=== DONE ==="
echo "Open http://$PUBLIC_IP"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status cv-editor      # gunicorn status"
echo "  sudo systemctl status nginx           # nginx status"
echo "  sudo journalctl -u cv-editor -f       # app logs"
echo "  sudo systemctl restart cv-editor      # restart after code changes"
