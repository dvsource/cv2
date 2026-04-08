import { useState, useEffect, useCallback, useRef } from "react";
// @ts-expect-error - PdfOptions imported for future use (Task 4: Wire OptionsPanel into App.tsx)
import type { CvData, PdfOptions, VersionSummary, JobListItem, Period, PeriodDate } from "./types";
import { JobPanel } from "./JobPanel";

interface Toast {
  message: string;
  type: "success" | "error";
  visible: boolean;
}

// --- Constants and helpers ---

const CANONICAL_SECTIONS = ["skills", "achievements", "experience", "projects", "education", "interests"] as const;
const DEFAULT_PERIOD: Period = { start: { year: new Date().getFullYear(), month: 1 }, end: "present" };

function normaliseCvData(raw: Record<string, unknown>): CvData {
  const d = raw as unknown as CvData;
  if (!Array.isArray(d.interests)) d.interests = [];
  if (!Array.isArray(d.achievements)) d.achievements = [];
  // Ensure sectionOrder contains all canonical keys
  const stored = Array.isArray(d.sectionOrder) ? [...d.sectionOrder] : [...CANONICAL_SECTIONS];
  for (const key of CANONICAL_SECTIONS) {
    if (!stored.includes(key)) stored.push(key);
  }
  d.sectionOrder = stored;
  // Ensure periods are structured (fallback for any remaining string periods)
  for (const exp of d.experience ?? []) {
    for (const role of exp.roles ?? []) {
      if (typeof (role.period as unknown) === "string" || !role.period) {
        role.period = { ...DEFAULT_PERIOD };
      }
    }
  }
  for (const edu of d.education ?? []) {
    if (typeof (edu.period as unknown) === "string" || !edu.period) {
      edu.period = { ...DEFAULT_PERIOD };
    }
  }
  if (!d.pdfOptions) d.pdfOptions = {};
  return d;
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

function DragHandleIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
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
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}) {
  return (
    <section
      className="mb-5"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 cursor-pointer group"
      >
        {draggable && (
          <span
            className="shrink-0 opacity-30 group-hover:opacity-70 transition-opacity"
            draggable
            onDragStart={(e) => { e.stopPropagation(); onDragStart?.(); }}
            onDragEnd={(e) => { e.stopPropagation(); onDragEnd?.(); }}
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandleIcon />
          </span>
        )}
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

// --- PeriodPicker ---

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 46 }, (_, i) => 1990 + i); // 1990-2035

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const isPresent = period.end === "present";
  const endDate = isPresent ? null : (period.end as PeriodDate);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 w-8 shrink-0">From</span>
        <select
          className={inputClasses + " py-1.5 pr-1 text-sm"}
          value={period.start.month}
          onChange={(e) =>
            onChange({ ...period, start: { ...period.start, month: +e.target.value } })
          }
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={inputClasses + " py-1.5 pr-1 text-sm"}
          value={period.start.year}
          onChange={(e) =>
            onChange({ ...period, start: { ...period.start, year: +e.target.value } })
          }
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 w-8 shrink-0">To</span>
        <select
          className={inputClasses + " py-1.5 pr-1 text-sm"}
          value={endDate?.month ?? 12}
          disabled={isPresent}
          onChange={(e) =>
            onChange({ ...period, end: { year: endDate?.year ?? new Date().getFullYear(), month: +e.target.value } })
          }
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className={inputClasses + " py-1.5 pr-1 text-sm"}
          value={endDate?.year ?? new Date().getFullYear()}
          disabled={isPresent}
          onChange={(e) =>
            onChange({ ...period, end: { year: +e.target.value, month: endDate?.month ?? 12 } })
          }
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600 ml-1 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-[#1b2a4a]"
            checked={isPresent}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...period, end: "present" });
              } else {
                const now = new Date();
                onChange({ ...period, end: { year: now.getFullYear(), month: now.getMonth() + 1 } });
              }
            }}
          />
          Present
        </label>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<CvData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"form" | "preview">("form");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragSrcRef = useRef<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const url = activeJobId != null ? `/api/jobs/${activeJobId}/versions` : "/api/versions";
      const res = await fetch(url);
      const list: VersionSummary[] = await res.json();
      setVersions(list);
      if (list.length > 0) setActiveVersionId(list[0].id);
    } catch {
      // silently ignore
    }
  }, [activeJobId]);

  const fetchData = useCallback(async () => {
    const [cvData, versionList] = await Promise.all([
      fetch("/api/cv").then((r) => r.json()),
      fetch("/api/versions").then((r) => r.json()),
    ]);
    setData(normaliseCvData(cvData));
    setVersions(versionList);
    if (versionList.length > 0) setActiveVersionId(versionList[0].id);
  }, []);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/jobs");
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
    fetchJobs();
  }, [fetchData, fetchJobs]);

  useEffect(() => {
    fetchVersions();
  }, [activeJobId, fetchVersions]);

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

  const switchToJob = useCallback(async (jobId: number | null) => {
    setActiveJobId(jobId);
    const url = jobId != null ? `/api/jobs/${jobId}/cv` : "/api/cv";
    const res = await fetch(url);
    if (res.ok) {
      const raw = await res.json();
      setData(normaliseCvData(raw));
      setUnsaved(false);
      setPdfUrl(null);
    }
    setPanelOpen(false);
  }, []);

  const saveData = useCallback(async () => {
    if (!data) return;
    try {
      const url = activeJobId != null ? `/api/jobs/${activeJobId}/cv` : "/api/cv";
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      setUnsaved(false);
      showToast("CV saved", "success");
      fetchVersions();
    } catch {
      showToast("Failed to save CV", "error");
    }
  }, [data, activeJobId, showToast, fetchVersions]);

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
      const url = activeJobId != null ? `/api/jobs/${activeJobId}/generate` : "/api/generate";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setMobileView("preview");
      showToast("PDF generated successfully", "success");
      fetchVersions();
    } catch {
      showToast("Failed to generate PDF", "error");
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setLoading(true);
    try {
      const url = activeJobId != null ? `/api/jobs/${activeJobId}/generate` : "/api/generate";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${data?.contact.name || "cv"}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      showToast("PDF downloaded", "success");
      fetchVersions();
    } catch {
      showToast("Failed to download PDF", "error");
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (id: number) => {
    try {
      const url = activeJobId != null ? `/api/jobs/${activeJobId}/versions/${id}` : `/api/versions/${id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const version = await res.json();
      setData(normaliseCvData(version.data));
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
        setData(normaliseCvData(parsed));
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
      <JobPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        jobs={jobs}
        activeJobId={activeJobId}
        onSelectJob={switchToJob}
        onJobsChanged={fetchJobs}
      />
      {/* Panel toggle */}
      <button
        type="button"
        onClick={() => setPanelOpen(o => !o)}
        aria-expanded={panelOpen}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-[#1b2a4a] text-white px-1.5 py-4 rounded-r-lg shadow-lg hover:bg-[#253d6e] transition-colors"
        title="Job tracker"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Top Header Bar */}
      <header className="bg-[#1b2a4a] text-white px-3 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-wide">CV Editor</h1>
          {activeJobId != null && (() => {
            const job = jobs.find(j => j.id === activeJobId);
            return job ? (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium truncate max-w-xs">
                {job.company} — {job.role}
              </span>
            ) : null;
          })()}
          {activeJobId != null && (
            <button
              type="button"
              onClick={() => switchToJob(null)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Switch to General
            </button>
          )}
          {unsaved && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Unsaved changes
            </span>
          )}
          {!unsaved && data && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              Saved
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
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
            title="Export CV as JSON"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
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
            onClick={saveData}
            disabled={!unsaved}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save CV"
          >
            <SaveIcon />
            Save
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
          >
            {loading ? <SpinnerIcon /> : <DownloadIcon />}
            {loading ? "Generating..." : "Generate PDF"}
          </button>
          <button
            onClick={download}
            disabled={loading}
            className="hidden lg:flex items-center gap-1.5 px-4 py-1.5 text-sm bg-white text-[#1b2a4a] font-medium rounded-md hover:bg-gray-100 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <SaveIcon />
            Download
          </button>
        </div>
      </header>

      {/* Mobile View Toggle */}
      <div className="lg:hidden flex bg-gray-50 border-b border-gray-200 shrink-0">
        <button
          onClick={() => setMobileView("form")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors duration-150 cursor-pointer ${
            mobileView === "form"
              ? "text-[#1b2a4a] border-b-2 border-[#1b2a4a]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileView === "preview"
              ? "text-[#1b2a4a] border-b-2 border-[#1b2a4a]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Preview
          {pdfUrl && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Form Panel */}
        <div className={`w-full lg:w-[700px] lg:shrink-0 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 bg-gray-50 custom-scrollbar shadow-[2px_0_8px_rgba(0,0,0,0.06)] ${mobileView === "preview" ? "hidden lg:block" : ""}`}>
          {/* Contact */}
          <Section
            title="Contact"
            open={isOpen("contact")}
            onToggle={() => toggleSection("contact")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {(["name", "email", "phone", "website", "linkedin", "github"] as const).map((f) => (
                <label key={f} className="flex flex-col gap-1">
                  <span className={labelClasses}>{f}</span>
                  <input
                    className={inputClasses}
                    value={data.contact[f] ?? ""}
                    onChange={(e) =>
                      update((d) => {
                        d.contact[f] = e.target.value;
                      })
                    }
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClasses}>title / role</span>
                <input
                  className={inputClasses}
                  placeholder="e.g. Full Stack Engineer"
                  value={data.contact.title ?? ""}
                  onChange={(e) =>
                    update((d) => {
                      d.contact.title = e.target.value;
                    })
                  }
                />
              </label>
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

          {/* Dynamic orderable sections */}
          {(data.sectionOrder ?? [...CANONICAL_SECTIONS]).map((key) => {
            const dragProps = {
              draggable: true as const,
              onDragStart: () => { dragSrcRef.current = key; },
              onDragOver: (e: React.DragEvent) => e.preventDefault(),
              onDragEnd: () => { dragSrcRef.current = null; },
              onDrop: () => {
                const src = dragSrcRef.current;
                if (!src || src === key) return;
                update((d) => {
                  const order = [...(d.sectionOrder ?? [...CANONICAL_SECTIONS])];
                  const from = order.indexOf(src);
                  const to = order.indexOf(key);
                  if (from === -1 || to === -1) return;
                  order.splice(from, 1);
                  order.splice(to, 0, src);
                  d.sectionOrder = order;
                });
                dragSrcRef.current = null;
              },
            };

            if (key === "skills") return (
              <Section key="skills" title="Skills" count={data.skills.length} open={isOpen("skills")} onToggle={() => toggleSection("skills")} {...dragProps}>
                {data.skills.map((skill, si) => (
                  <div key={si} className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
                    <div className="flex gap-2 items-center">
                      <input
                        className={`flex-1 sm:w-[140px] sm:flex-initial sm:shrink-0 ${inputClasses}`}
                        placeholder="Category"
                        value={skill.label}
                        onChange={(e) =>
                          update((d) => {
                            d.skills[si].label = e.target.value;
                          })
                        }
                      />
                      <button
                        className="sm:hidden p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
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
                    <div className="flex gap-2 items-center flex-1">
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
                        className="hidden sm:block p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
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
            );

            if (key === "achievements") return (
              <Section key="achievements" title="Achievements" count={data.achievements?.length ?? 0} open={isOpen("achievements")} onToggle={() => toggleSection("achievements")} {...dragProps}>
                {(data.achievements ?? []).map((item, ai) => (
                  <div key={ai} className="flex gap-2 items-center mb-3">
                    <input
                      className={`flex-1 ${inputClasses}`}
                      placeholder="Achievement"
                      value={item}
                      onChange={(e) =>
                        update((d) => {
                          if (!d.achievements) d.achievements = [];
                          d.achievements[ai] = e.target.value;
                        })
                      }
                    />
                    <button
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-150 cursor-pointer shrink-0"
                      onClick={() =>
                        update((d) => {
                          d.achievements?.splice(ai, 1);
                        })
                      }
                      title="Remove achievement"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button
                  className={addBtnClasses}
                  onClick={() =>
                    update((d) => {
                      if (!d.achievements) d.achievements = [];
                      d.achievements.push("");
                    })
                  }
                >
                  <span className="text-lg leading-none">+</span> Add Achievement
                </button>
              </Section>
            );

            if (key === "experience") return (
              <Section key="experience" title="Experience" count={data.experience.length} open={isOpen("experience")} onToggle={() => toggleSection("experience")} {...dragProps}>
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
                        <div className="flex flex-col sm:flex-row gap-3 mb-2">
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
                          <div className="flex flex-col gap-1">
                            <span className={labelClasses}>Period</span>
                            <PeriodPicker
                              period={role.period}
                              onChange={(p) =>
                                update((d) => {
                                  d.experience[ei].roles[ri].period = p;
                                })
                              }
                            />
                          </div>
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
                            d.experience[ei].roles.push({ title: "", period: { ...DEFAULT_PERIOD }, description: "" });
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
                      d.experience.push({ company: "", roles: [{ title: "", period: { ...DEFAULT_PERIOD }, description: "" }] });
                    })
                  }
                >
                  <span className="text-lg leading-none">+</span> Add Company
                </button>
              </Section>
            );

            if (key === "projects") return (
              <Section key="projects" title="Projects" count={data.projects.length} open={isOpen("projects")} onToggle={() => toggleSection("projects")} {...dragProps}>
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
            );

            if (key === "education") return (
              <Section key="education" title="Education" count={data.education.length} open={isOpen("education")} onToggle={() => toggleSection("education")} {...dragProps}>
                {data.education.map((edu, ei) => (
                  <div key={ei} className={cardClasses}>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-2">
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
                      <div className="flex items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <span className={labelClasses}>Period</span>
                          <PeriodPicker
                            period={edu.period}
                            onChange={(p) =>
                              update((d) => {
                                d.education[ei].period = p;
                              })
                            }
                          />
                        </div>
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
                      d.education.push({ institution: "", degree: "", period: { ...DEFAULT_PERIOD }, focus: [] });
                    })
                  }
                >
                  <span className="text-lg leading-none">+</span> Add Education
                </button>
              </Section>
            );

            if (key === "interests") return (
              <Section key="interests" title="Interests" count={data.interests.length} open={isOpen("interests")} onToggle={() => toggleSection("interests")} {...dragProps}>
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
            );

            return null;
          })}
        </div>

        {/* Preview Panel */}
        <div className={`flex-1 bg-gray-100 items-center justify-center min-h-0 ${mobileView === "preview" ? "flex" : "hidden lg:flex"}`}>
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

      {/* Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#1b2a4a] border-t border-white/10 px-3 py-2.5 flex items-center gap-2 z-20">
        <button
          onClick={exportJson}
          className="flex items-center justify-center p-2 text-white/70 border border-white/20 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
          title="Export JSON"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center p-2 text-white/70 border border-white/20 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer"
          title="Import JSON"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
        <button
          onClick={saveData}
          disabled={!unsaved}
          className="flex items-center justify-center p-2 text-white/70 border border-white/20 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Save CV"
        >
          <SaveIcon />
        </button>
        <button
          onClick={generate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-white border border-white/30 rounded-md hover:bg-white/10 transition-colors duration-150 cursor-pointer disabled:opacity-60"
        >
          {loading ? <SpinnerIcon /> : <DownloadIcon />}
          {loading ? "Generating..." : "Generate PDF"}
        </button>
        <button
          onClick={download}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-white text-[#1b2a4a] font-medium rounded-md hover:bg-gray-100 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <SaveIcon />
          Download
        </button>
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
