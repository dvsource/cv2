import { useState, useEffect } from "react";

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

interface Skill {
  label: string;
  items: string[];
}

interface CvData {
  contact: Contact;
  summary: string;
  skills: Skill[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
}

function App() {
  const [data, setData] = useState<CvData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading...
      </div>
    );

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
    <div className="flex h-screen">
      {/* Form Panel */}
      <div className="flex-1 overflow-y-auto p-6 max-w-[600px] border-r border-gray-200">
        <h1 className="text-2xl font-bold text-[#1b2a4a] mb-6">CV Editor</h1>

        {/* Contact */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Contact
          </h2>
          <div className="grid grid-cols-2 gap-x-3">
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
              <label key={f} className="flex flex-col gap-0.5 mb-2">
                <span className="text-xs text-gray-500 capitalize">{f}</span>
                <input
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
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
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Summary
          </h2>
          <textarea
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit] resize-y"
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
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Skills
          </h2>
          {data.skills.map((skill, si) => (
            <div key={si} className="flex gap-2 items-center mb-2">
              <input
                className="w-[130px] shrink-0 px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                placeholder="Category"
                value={skill.label}
                onChange={(e) =>
                  update((d) => {
                    d.skills[si].label = e.target.value;
                  })
                }
              />
              <input
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                placeholder="Comma-separated values"
                value={skill.items.join(", ")}
                onChange={(e) =>
                  update((d) => {
                    d.skills[si].items = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                  })
                }
              />
              <button
                className="px-2 py-1 text-red-600 border border-red-600 rounded text-xs shrink-0 cursor-pointer hover:bg-red-50"
                onClick={() =>
                  update((d) => {
                    d.skills.splice(si, 1);
                  })
                }
              >
                x
              </button>
            </div>
          ))}
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
            onClick={() =>
              update((d) => {
                d.skills.push({ label: "", items: [] });
              })
            }
          >
            + Add Skill Category
          </button>
        </section>

        {/* Experience */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Experience
          </h2>
          {data.experience.map((exp, ei) => (
            <div
              key={ei}
              className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50/80"
            >
              <div className="flex items-end gap-3">
                <label className="flex-1 flex flex-col gap-0.5 mb-2">
                  <span className="text-xs text-gray-500 capitalize">
                    Company
                  </span>
                  <input
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                    value={exp.company}
                    onChange={(e) =>
                      update((d) => {
                        d.experience[ei].company = e.target.value;
                      })
                    }
                  />
                </label>
                <button
                  className="px-2 py-1.5 text-red-600 border border-red-600 rounded text-xs cursor-pointer hover:bg-red-50 mt-1"
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
                <div key={ri} className="border-l-3 border-gray-300 pl-3 my-2">
                  <div className="flex gap-3">
                    <label className="flex-1 flex flex-col gap-0.5 mb-2">
                      <span className="text-xs text-gray-500 capitalize">
                        Title
                      </span>
                      <input
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                        value={role.title}
                        onChange={(e) =>
                          update((d) => {
                            d.experience[ei].roles[ri].title = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label className="flex-1 flex flex-col gap-0.5 mb-2">
                      <span className="text-xs text-gray-500 capitalize">
                        Period
                      </span>
                      <input
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                        value={role.period}
                        onChange={(e) =>
                          update((d) => {
                            d.experience[ei].roles[ri].period = e.target.value;
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-0.5 mb-2">
                    <span className="text-xs text-gray-500 capitalize">
                      Description
                    </span>
                    <textarea
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit] resize-y"
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
                    className="px-2 py-1 text-red-600 border border-red-600 rounded text-xs cursor-pointer hover:bg-red-50 mt-1"
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
                className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
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
              <label className="inline-flex flex-row items-center gap-1.5 cursor-pointer select-none ml-3">
                <input
                  type="checkbox"
                  className="accent-[#1b2a4a]"
                  checked={!!exp.pageBreakAfter}
                  onChange={(e) =>
                    update((d) => {
                      d.experience[ei].pageBreakAfter = e.target.checked;
                    })
                  }
                />
                <span className="text-xs text-gray-400">Page break after</span>
              </label>
            </div>
          ))}
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
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
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Projects
          </h2>
          {data.projects.map((proj, pi) => (
            <div
              key={pi}
              className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50/80"
            >
              <label className="flex flex-col gap-0.5 mb-2">
                <span className="text-xs text-gray-500 capitalize">Name</span>
                <input
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                  value={proj.name}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[pi].name = e.target.value;
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-0.5 mb-2">
                <span className="text-xs text-gray-500 capitalize">
                  Description
                </span>
                <textarea
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit] resize-y"
                  rows={4}
                  value={proj.description}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[pi].description = e.target.value;
                    })
                  }
                />
              </label>
              <div className="flex items-center justify-between mt-1">
                <button
                  className="px-2 py-1 text-red-600 border border-red-600 rounded text-xs cursor-pointer hover:bg-red-50"
                  onClick={() =>
                    update((d) => {
                      d.projects.splice(pi, 1);
                    })
                  }
                >
                  Remove
                </button>
                <label className="inline-flex flex-row items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-[#1b2a4a]"
                    checked={!!proj.pageBreakAfter}
                    onChange={(e) =>
                      update((d) => {
                        d.projects[pi].pageBreakAfter = e.target.checked;
                      })
                    }
                  />
                  <span className="text-xs text-gray-400">
                    Page break after
                  </span>
                </label>
              </div>
            </div>
          ))}
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
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
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-1.5 mb-3">
            Education
          </h2>
          {data.education.map((edu, ei) => (
            <div
              key={ei}
              className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50/80"
            >
              <div className="flex gap-3">
                <label className="flex-1 flex flex-col gap-0.5 mb-2">
                  <span className="text-xs text-gray-500 capitalize">
                    Institution
                  </span>
                  <input
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                    value={edu.institution}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].institution = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="flex-1 flex flex-col gap-0.5 mb-2">
                  <span className="text-xs text-gray-500 capitalize">
                    Period
                  </span>
                  <input
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                    value={edu.period}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].period = e.target.value;
                      })
                    }
                  />
                </label>
              </div>
              <label className="flex flex-col gap-0.5 mb-2">
                <span className="text-xs text-gray-500 capitalize">
                  Degree
                </span>
                <input
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
                  value={edu.degree || ""}
                  onChange={(e) =>
                    update((d) => {
                      d.education[ei].degree = e.target.value;
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-0.5 mb-2">
                <span className="text-xs text-gray-500 capitalize">
                  Focus (comma-separated)
                </span>
                <input
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm font-[inherit]"
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
              <div className="flex items-center justify-between mt-1">
                <button
                  className="px-2 py-1 text-red-600 border border-red-600 rounded text-xs cursor-pointer hover:bg-red-50"
                  onClick={() =>
                    update((d) => {
                      d.education.splice(ei, 1);
                    })
                  }
                >
                  Remove
                </button>
                <label className="inline-flex flex-row items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-[#1b2a4a]"
                    checked={!!edu.pageBreakAfter}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].pageBreakAfter = e.target.checked;
                      })
                    }
                  />
                  <span className="text-xs text-gray-400">
                    Page break after
                  </span>
                </label>
              </div>
            </div>
          ))}
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
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

        {/* Actions */}
        <div className="flex gap-3 py-4 sticky bottom-0 bg-white border-t border-gray-200">
          <button
            className="px-6 py-2.5 bg-[#1b2a4a] text-white border border-[#1b2a4a] rounded text-base cursor-pointer hover:bg-[#2a3d66] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={generate}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate PDF"}
          </button>
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:bg-gray-100"
            onClick={save}
          >
            Save JSON
          </button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 sticky top-0 h-screen bg-gray-100 flex items-center justify-center">
        {pdfUrl ? (
          <iframe className="w-full h-full border-none" src={pdfUrl} title="PDF Preview" />
        ) : (
          <div className="text-gray-400 text-lg">
            Click "Generate PDF" to preview
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
