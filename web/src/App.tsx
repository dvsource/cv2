import { useState, useEffect, useCallback, useRef } from "react";

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
  items: string;
}

interface CvData {
  contact: Contact;
  summary: string;
  skills: Skill[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  interests: string[];
}

interface VersionSummary {
  id: number;
  created_at: string;
  source: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
  visible: boolean;
}

// --- Inline SVG Icons ---

function SaveIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      className="w-16 h-16 text-gray-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// --- Collapsible Section ---

function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 cursor-pointer group"
      >
        <ChevronIcon open={open} />
        <h2 className="text-base font-semibold text-gray-800 group-hover:text-[#1b2a4a] transition-colors">
          {title}
        </h2>
        {count !== undefined && !open && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

// --- Shared class strings ---

const inputClasses =
  "px-3 py-2 border border-gray-300 rounded-md text-sm font-[inherit] outline-none transition-colors duration-150 hover:border-gray-400 focus:ring-2 focus:ring-[#1b2a4a]/20 focus:border-[#1b2a4a]";
const labelClasses = "text-sm font-medium text-gray-600 capitalize";
const cardClasses =
  "bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm hover:shadow-md transition-shadow duration-200";
const addBtnClasses =
  "w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors duration-150 flex items-center justify-center gap-1.5";

function App() {
  const [data, setData] = useState<CvData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshVersions = useCallback(async () => {
    try {
      const res = await fetch("/api/versions");
      const list: VersionSummary[] = await res.json();
      setVersions(list);
      if (list.length > 0) setActiveVersionId(list[0].id);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/cv").then((r) => r.json()),
      fetch("/api/versions").then((r) => r.json()),
    ]).then(([cvData, versionList]) => {
      if (!Array.isArray(cvData.interests)) cvData.interests = [];
      setData(cvData);
      setVersions(versionList);
      if (versionList.length > 0) setActiveVersionId(versionList[0].id);
    });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast?.visible) return;
    const t = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
    }, 3000);
    return () => clearTimeout(t);
  }, [toast?.visible]);

  // Clear toast from DOM after exit animation
  useEffect(() => {
    if (toast && !toast.visible) {
      const t = setTimeout(() => setToast(null), 300);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type, visible: true });
    },
    [],
  );

  const toggleSection = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isOpen = (key: string) => !collapsed.has(key);

  if (!data)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon />
          <span className="text-gray-400 text-sm">Loading CV data...</span>
        </div>
      </div>
    );

  const update = (fn: (d: CvData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev!);
      fn(next);
      return next;
    });
    setUnsaved(true);
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      showToast("PDF generated successfully", "success");
      refreshVersions();
    } catch {
      showToast("Failed to generate PDF", "error");
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.contact.name || "cv"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF downloaded", "success");
      refreshVersions();
    } catch {
      showToast("Failed to download PDF", "error");
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (id: number) => {
    try {
      const res = await fetch(`/api/versions/${id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const version = await res.json();
      if (!Array.isArray(version.data.interests)) version.data.interests = [];
      setData(version.data);
      setActiveVersionId(id);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setUnsaved(id !== versions[0]?.id);
      showToast("Version restored", "success");
    } catch {
      showToast("Failed to restore version", "error");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.contact.name || "cv"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON exported", "success");
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed.interests)) parsed.interests = [];
        setData(parsed);
        setUnsaved(true);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        showToast("JSON imported", "success");
      } catch {
        showToast("Invalid JSON file", "error");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatVersionLabel = (v: VersionSummary) => {
    const d = new Date(v.created_at + (v.created_at.endsWith("Z") ? "" : "Z"));
    const date = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const sourceLabel =
      v.source === "generate"
        ? "PDF"
        : v.source === "import"
          ? "Import"
          : "Save";
    return `${date}, ${time} (${sourceLabel})`;
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Header Bar */}
      <header className="bg-[#1b2a4a] text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-wide">CV Editor</h1>
          {unsaved && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Saved
            </span>
          )}
          {!unsaved && data && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {versions.length > 0 && (
            <div className="flex items-center gap-1.5 mr-2">
              <svg
                className="w-4 h-4 text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <select
                className="bg-white/10 text-white text-sm border border-white/20 rounded-md px-2 py-1 outline-none cursor-pointer hover:bg-white/20 transition-colors duration-150"
                value={activeVersionId ?? ""}
                onChange={(e) => restoreVersion(Number(e.target.value))}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id} className="text-gray-900">
                    {formatVersionLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
            title="Export CV as JSON"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
            title="Import CV from JSON"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={importJson}
          />
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
          >
            {loading ? <SpinnerIcon /> : <DownloadIcon />}
            {loading ? "Generating..." : "Generate PDF"}
          </button>
          <button
            onClick={download}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-white text-[#1b2a4a] font-medium rounded-md hover:bg-gray-100 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <SaveIcon />
            Download
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Form Panel */}
        <div className="w-[700px] shrink-0 overflow-y-auto p-8 bg-gray-50 custom-scrollbar shadow-[2px_0_8px_rgba(0,0,0,0.06)]">
          {/* Contact */}
          <Section
            title="Contact"
            open={isOpen("contact")}
            onToggle={() => toggleSection("contact")}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
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
                <label key={f} className="flex flex-col gap-1">
                  <span className={labelClasses}>{f}</span>
                  <input
                    className={inputClasses}
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
          </Section>

          {/* Summary */}
          <Section
            title="Summary"
            open={isOpen("summary")}
            onToggle={() => toggleSection("summary")}
          >
            <textarea
              className={`w-full ${inputClasses} resize-y`}
              rows={8}
              value={data.summary}
              onChange={(e) =>
                update((d) => {
                  d.summary = e.target.value;
                })
              }
            />
          </Section>

          {/* Skills */}
          <Section
            title="Skills"
            count={data.skills.length}
            open={isOpen("skills")}
            onToggle={() => toggleSection("skills")}
          >
            {data.skills.map((skill, si) => (
              <div key={si} className="flex gap-2 items-center mb-3">
                <input
                  className={`w-[140px] shrink-0 ${inputClasses}`}
                  placeholder="Category"
                  value={skill.label}
                  onChange={(e) =>
                    update((d) => {
                      d.skills[si].label = e.target.value;
                    })
                  }
                />
                <input
                  className={`flex-1 ${inputClasses}`}
                  placeholder="Comma-separated values"
                  value={skill.items}
                  onChange={(e) =>
                    update((d) => {
                      d.skills[si].items = e.target.value;
                    })
                  }
                />
                <button
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
                  onClick={() =>
                    update((d) => {
                      d.skills.splice(si, 1);
                    })
                  }
                  title="Remove skill"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <button
              className={addBtnClasses}
              onClick={() =>
                update((d) => {
                  d.skills.push({ label: "", items: "" });
                })
              }
            >
              <span className="text-lg leading-none">+</span> Add Skill Category
            </button>
          </Section>

          {/* Experience */}
          <Section
            title="Experience"
            count={data.experience.length}
            open={isOpen("experience")}
            onToggle={() => toggleSection("experience")}
          >
            {data.experience.map((exp, ei) => (
              <div key={ei} className={cardClasses}>
                <div className="flex items-end gap-3 mb-3">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className={labelClasses}>Company</span>
                    <input
                      className={inputClasses}
                      value={exp.company}
                      onChange={(e) =>
                        update((d) => {
                          d.experience[ei].company = e.target.value;
                        })
                      }
                    />
                  </label>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer mb-0.5"
                    onClick={() =>
                      update((d) => {
                        d.experience.splice(ei, 1);
                      })
                    }
                    title="Remove company"
                  >
                    <TrashIcon />
                  </button>
                </div>
                {exp.roles.map((role, ri) => (
                  <div
                    key={ri}
                    className="border-l-2 border-[#1b2a4a]/20 pl-4 ml-1 my-3"
                  >
                    <div className="flex gap-3 mb-2">
                      <label className="flex-1 flex flex-col gap-1">
                        <span className={labelClasses}>Title</span>
                        <input
                          className={inputClasses}
                          value={role.title}
                          onChange={(e) =>
                            update((d) => {
                              d.experience[ei].roles[ri].title = e.target.value;
                            })
                          }
                        />
                      </label>
                      <label className="flex-1 flex flex-col gap-1">
                        <span className={labelClasses}>Period</span>
                        <input
                          className={inputClasses}
                          value={role.period}
                          onChange={(e) =>
                            update((d) => {
                              d.experience[ei].roles[ri].period =
                                e.target.value;
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 mb-2">
                      <span className={labelClasses}>Description</span>
                      <textarea
                        className={`w-full ${inputClasses} resize-y`}
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
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer"
                      onClick={() =>
                        update((d) => {
                          d.experience[ei].roles.splice(ri, 1);
                        })
                      }
                      title="Remove role"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    className="py-1.5 px-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-1"
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
                    <span className="text-lg leading-none">+</span> Add Role
                  </button>
                  <label className="inline-flex flex-row items-center gap-1.5 cursor-pointer select-none ml-auto">
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
                    <span className="text-xs text-gray-400">
                      Page break after
                    </span>
                  </label>
                </div>
              </div>
            ))}
            <button
              className={addBtnClasses}
              onClick={() =>
                update((d) => {
                  d.experience.push({
                    company: "",
                    roles: [{ title: "", period: "", description: "" }],
                  });
                })
              }
            >
              <span className="text-lg leading-none">+</span> Add Company
            </button>
          </Section>

          {/* Projects */}
          <Section
            title="Projects"
            count={data.projects.length}
            open={isOpen("projects")}
            onToggle={() => toggleSection("projects")}
          >
            {data.projects.map((proj, pi) => (
              <div key={pi} className={cardClasses}>
                <div className="flex items-end gap-3 mb-2">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className={labelClasses}>Name</span>
                    <input
                      className={inputClasses}
                      value={proj.name}
                      onChange={(e) =>
                        update((d) => {
                          d.projects[pi].name = e.target.value;
                        })
                      }
                    />
                  </label>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer mb-0.5"
                    onClick={() =>
                      update((d) => {
                        d.projects.splice(pi, 1);
                      })
                    }
                    title="Remove project"
                  >
                    <TrashIcon />
                  </button>
                </div>
                <label className="flex flex-col gap-1 mb-2">
                  <span className={labelClasses}>Description</span>
                  <textarea
                    className={`w-full ${inputClasses} resize-y`}
                    rows={4}
                    value={proj.description}
                    onChange={(e) =>
                      update((d) => {
                        d.projects[pi].description = e.target.value;
                      })
                    }
                  />
                </label>
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
            ))}
            <button
              className={addBtnClasses}
              onClick={() =>
                update((d) => {
                  d.projects.push({ name: "", description: "" });
                })
              }
            >
              <span className="text-lg leading-none">+</span> Add Project
            </button>
          </Section>

          {/* Education */}
          <Section
            title="Education"
            count={data.education.length}
            open={isOpen("education")}
            onToggle={() => toggleSection("education")}
          >
            {data.education.map((edu, ei) => (
              <div key={ei} className={cardClasses}>
                <div className="flex items-end gap-3 mb-2">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className={labelClasses}>Institution</span>
                    <input
                      className={inputClasses}
                      value={edu.institution}
                      onChange={(e) =>
                        update((d) => {
                          d.education[ei].institution = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label className="flex-1 flex flex-col gap-1">
                    <span className={labelClasses}>Period</span>
                    <input
                      className={inputClasses}
                      value={edu.period}
                      onChange={(e) =>
                        update((d) => {
                          d.education[ei].period = e.target.value;
                        })
                      }
                    />
                  </label>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer mb-0.5"
                    onClick={() =>
                      update((d) => {
                        d.education.splice(ei, 1);
                      })
                    }
                    title="Remove education"
                  >
                    <TrashIcon />
                  </button>
                </div>
                <label className="flex flex-col gap-1 mb-2">
                  <span className={labelClasses}>Degree</span>
                  <input
                    className={inputClasses}
                    value={edu.degree || ""}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].degree = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 mb-2">
                  <span className={labelClasses}>Focus (comma-separated)</span>
                  <input
                    className={inputClasses}
                    value={(edu.focus || []).join(", ")}
                    onChange={(e) =>
                      update((d) => {
                        d.education[ei].focus = e.target.value
                          .split(",")
                          .map((s) => s.trim());
                      })
                    }
                    onBlur={() =>
                      update((d) => {
                        d.education[ei].focus =
                          d.education[ei].focus.filter(Boolean);
                      })
                    }
                  />
                </label>
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
            ))}
            <button
              className={addBtnClasses}
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
              <span className="text-lg leading-none">+</span> Add Education
            </button>
          </Section>

          {/* Interests */}
          <Section
            title="Interests"
            count={data.interests.length}
            open={isOpen("interests")}
            onToggle={() => toggleSection("interests")}
          >
            {data.interests.map((item, ii) => (
              <div key={ii} className="flex gap-2 items-center mb-3">
                <input
                  className={`flex-1 ${inputClasses}`}
                  placeholder="Interest"
                  value={item}
                  onChange={(e) =>
                    update((d) => {
                      d.interests[ii] = e.target.value;
                    })
                  }
                />
                <button
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
                  onClick={() =>
                    update((d) => {
                      d.interests.splice(ii, 1);
                    })
                  }
                  title="Remove interest"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <button
              className={addBtnClasses}
              onClick={() =>
                update((d) => {
                  d.interests.push("");
                })
              }
            >
              <span className="text-lg leading-none">+</span> Add Interest
            </button>
          </Section>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center min-h-0">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-10 h-10 animate-spin text-[#1b2a4a]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-gray-500 text-sm">
                Generating your CV...
              </span>
            </div>
          ) : pdfUrl ? (
            <iframe
              className="w-full h-full border-none"
              src={pdfUrl}
              title="PDF Preview"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <DocIcon />
              <p className="text-gray-400 text-lg font-medium">
                Generate a preview
              </p>
              <p className="text-gray-300 text-sm">
                Edit your CV and click "Generate PDF" to see it here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 ${toast.visible ? "toast-enter" : "toast-exit"}`}
        >
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <svg
                className="w-4 h-4 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
