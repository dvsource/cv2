# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.13-slim

# Install Noto Sans fonts
RUN apt-get update && \
    apt-get install -y --no-install-recommends fonts-noto-core && \
    mkdir -p /usr/share/fonts/noto && \
    cp /usr/share/fonts/truetype/noto/NotoSans-*.ttf /usr/share/fonts/noto/ && \
    cp /usr/share/fonts/truetype/noto/NotoSansMono-*.ttf /usr/share/fonts/noto/ && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py build_cv.py ./
COPY --from=frontend /app/web/dist ./web/dist

EXPOSE 5000

CMD ["python", "server.py"]
