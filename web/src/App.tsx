import { useState, useEffect } from "react";
import "./App.css";

interface Contact {
  name: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  github: string;
}

interface Role {
  title: string;
  period: string;
  description: string;
}

interface Experience {
  company: string;
  roles: Role[];
  pageBreakAfter?: boolean;
}

interface Project {
  name: string;
  description: string;
  pageBreakAfter?: boolean;
}

interface Education {
  institution: string;
  degree?: string;
  period: string;
  focus: string[];
  pageBreakAfter?: boolean;
}

interface Skills {
  languages: string[];
  frontend: string[];
  backend: string[];
  fullstack: string[];
  devops_cloud: string[];
  databases: string[];
}

interface CvData {
  contact: Contact;
  summary: string;
  skills: Skills;
  experience: Experience[];
  projects: Project[];
  education: Education[];
}

const SKILL_KEYS: { key: keyof Skills; label: string }[] = [
  { key: "languages", label: "Languages" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "fullstack", label: "Fullstack" },
  { key: "devops_cloud", label: "DevOps & Cloud" },
  { key: "databases", label: "Databases" },
];

function App() {
  const [data, setData] = useState<CvData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="loading">Loading...</div>;

  const update = (fn: (d: CvData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev!);
      fn(next);
      return next;
    });
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    await fetch("/api/cv", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  return (
    <div className="layout">
      <div className="form-panel">
        <h1>CV Editor</h1>

        {/* Contact */}
        <section>
          <h2>Contact</h2>
          <div className="field-grid">
            {(
              [
                "name",
                "email",
                "phone",
                "website",
                "linkedin",
                "github",
              ] as const
            ).map((f) => (
              <label key={f}>
                <span>{f}</span>
                <input
                  value={data.contact[f]}
                  onChange={(e) =>
                    update((d) => {
                      d.contact[f] = e.target.value;
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        {/* Summary */}
        <section>
          <h2>Summary</h2>
          <textarea
            rows={8}
            value={data.summary}
            onChange={(e) =>
              update((d) => {
                d.summary = e.target.value;
              })
            }
          />
        </section>

        {/* Skills */}
        <section>
          <h2>Skills</h2>
          {SKILL_KEYS.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                value={(data.skills[key] || []).join(", ")}
                onChange={(e) =>
                  update((d) => {
                    d.skills[key] = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                  })
                }
              />
            </label>
          ))}
        </section>

        {/* Experience */}
        <section>
          <h2>Experience</h2>
          {data.experience.map((exp, ei) => (
            <div key={ei} className="card">
              <div className="card-header">
                <label>
                  <span>Company</span>
                  <input
                    value={exp.company}
                    onChange={(e) =>
                      update((d) => {
                        d.experience[ei].company = e.target.value;
                      })
                    }
                  />
                </label>
                <button
                  className="remove"
                  onClick={() =>
                    update((d) => {
                      d.experience.splice(ei, 1);
                    })
                  }
                >
                  Remove Company
                </button>
              </div>
              {exp.roles.map((role, ri) => (
                <div key={ri} className="sub-card">
                  <div className="field-row">
                    <label>
                      <span>Title</span>
                      <input
                        value={role.title}
                        onChange={(e) =>
                          update((d) => {
                            d.experience[ei].roles[ri].title = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Period</span>
                      <input
                        value={role.period}
                        onChange={(e) =>
                          update((d) => {
                            d.experience[ei].roles[ri].period = e.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    <span>Description</span>
                    <textarea
                      rows={6}
                      value={role.description}
                      onChange={(e) =>
                        update((d) => {
                          d.experience[ei].roles[ri].description =
                            e.target.value;
                        })
                      }
                    />
                  </label>
                  <button
                    className="remove"
                    onClick={() =>
                      update((d) => {
                        d.experience[ei].roles.splice(ri, 1);
                      })
                    }
                  >
                    Remove Role
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  update((d) => {
                    d.experience[ei].roles.push({
                      title: "",
                      period: "",
                      description: "",
                    });
                  })
                }
              >
                + Add Role
              </button>
              <label className="page-break-toggle">
                <input
                  type="checkbox"
                  checked={!!exp.pageBreakAfter}
                  onChange={(e) =>
                    update((d) => {
                      d.experience[ei].pageBreakAfter = e.target.checked;
                    })
                  }
                />
                <span>Page break after</span>
              </label>
            </div>
          ))}
          <button
            onClick={() =>
              update((d) => {
                d.experience.push({
                  company: "",
                  roles: [{ title: "", period: "", description: "" }],
                });
              })
            }
          >
            + Add Company
          </button>
        </section>

        {/* Projects */}
        <section>
          <h2>Projects</h2>
          {data.projects.map((proj, pi) => (
            <div key={pi} className="card">
              <label>
                <span>Name</span>
                <input
                  value={proj.name}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[pi].name = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  rows={4}
                  value={proj.description}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[pi].description = e.target.value;
                    })
                  }
                />
              </label>
              <div className="card-footer">
                <button
                  className="remove"
                  onClick={() =>
                    update((d) => {
                      d.projects.splice(pi, 1);
                    })
                  }
                >
                  Remove
                </button>
                <label className="page-break-toggle">
                  <input
                    type="checkbox"
                    checked={!!proj.pageBreakAfter}
                    onChange={(e) =>
                      update((d) => {
                        d.projects[pi].pageBreakAfter = e.target.checked;
                      })
                    }
                  />
                  <span>Page break after</span>
                </label>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              update((d) => {
                d.projects.push({ name: "", description: "" });
              })
            }
          >
            + Add Project
          </button>
        </section>

        {/* Education */}
        <section>
          <h2>Education</h2>
          {data.education.map((edu, ei) => (
            <div key={ei} className="card">
              <div className="field-row">
                <label>
                  <span>Institution</span>
                  <input
                    value={edu.institution}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].institution = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  <span>Period</span>
                  <input
                    value={edu.period}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].period = e.target.value;
                      })
                    }
                  />
                </label>
              </div>
              <label>
                <span>Degree</span>
                <input
                  value={edu.degree || ""}
                  onChange={(e) =>
                    update((d) => {
                      d.education[ei].degree = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                <span>Focus (comma-separated)</span>
                <input
                  value={(edu.focus || []).join(", ")}
                  onChange={(e) =>
                    update((d) => {
                      d.education[ei].focus = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    })
                  }
                />
              </label>
              <div className="card-footer">
                <button
                  className="remove"
                  onClick={() =>
                    update((d) => {
                      d.education.splice(ei, 1);
                    })
                  }
                >
                  Remove
                </button>
                <label className="page-break-toggle">
                  <input
                    type="checkbox"
                    checked={!!edu.pageBreakAfter}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].pageBreakAfter = e.target.checked;
                      })
                    }
                  />
                  <span>Page break after</span>
                </label>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              update((d) => {
                d.education.push({
                  institution: "",
                  degree: "",
                  period: "",
                  focus: [],
                });
              })
            }
          >
            + Add Education
          </button>
        </section>

        <div className="actions">
          <button className="primary" onClick={generate} disabled={loading}>
            {loading ? "Generating..." : "Generate PDF"}
          </button>
          <button onClick={save}>Save JSON</button>
        </div>
      </div>

      <div className="preview-panel">
        {pdfUrl ? (
          <iframe src={pdfUrl} title="PDF Preview" />
        ) : (
          <div className="placeholder">Click "Generate PDF" to preview</div>
        )}
      </div>
    </div>
  );
}

export default App;
