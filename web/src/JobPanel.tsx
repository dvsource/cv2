import { useState, useCallback } from "react";
import type { Job, JobListItem, JobStatus, JobSummary } from "./types";

// ── Status config ──────────────────────────────────────────────

const STATUS_LABELS: Record<JobStatus, string> = {
  active: "Saved",
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  offered: "Offered",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  active: "bg-gray-100 text-gray-600",
  applied: "bg-blue-100 text-blue-700",
  interview: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-600",
  offered: "bg-green-100 text-green-700",
};

// Colors for job icons in the collapsed icon rail
const ICON_COLORS: Record<JobStatus, string> = {
  active: "bg-gray-400 text-white",
  applied: "bg-blue-500 text-white",
  interview: "bg-yellow-400 text-gray-900",
  rejected: "bg-red-400 text-white",
  offered: "bg-green-500 text-white",
};

// ── Summary Card ───────────────────────────────────────────────

function SummaryCard({ summary }: { summary: JobSummary }) {
  const hasContent =
    summary.tech_skills.length > 0 ||
    summary.other_skills.length > 0 ||
    summary.key_points.length > 0;

  if (!hasContent) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2 text-xs">
      {summary.tech_skills.length > 0 && (
        <div>
          <span className="font-semibold text-blue-800 block mb-1">Tech Skills</span>
          <div className="flex flex-wrap gap-1">
            {summary.tech_skills.map((s) => (
              <span key={s} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {summary.other_skills.length > 0 && (
        <div>
          <span className="font-semibold text-blue-800 block mb-1">Other Skills</span>
          <div className="flex flex-wrap gap-1">
            {summary.other_skills.map((s) => (
              <span key={s} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {summary.key_points.length > 0 && (
        <div>
          <span className="font-semibold text-blue-800 block mb-1">Key Points</span>
          <ul className="space-y-0.5 text-gray-700">
            {summary.key_points.map((p) => (
              <li key={p} className="flex gap-1.5">
                <span className="text-blue-400 shrink-0">·</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Job List Item ──────────────────────────────────────────────

function JobCard({
  job,
  active,
  onSelect,
  onDelete,
}: {
  job: JobListItem;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`border rounded-xl p-3 mb-2 cursor-pointer transition-all duration-150 ${
        active
          ? "border-[#1b2a4a] bg-[#1b2a4a]/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-gray-800 truncate">{job.company || "Untitled"}</div>
          <div className="text-xs text-gray-500 truncate">{job.role}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
            {STATUS_LABELS[job.status]}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
            title="Delete job"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {job.summary.tech_skills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {job.summary.tech_skills.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
          {job.summary.tech_skills.length > 4 && (
            <span className="text-xs text-gray-400">+{job.summary.tech_skills.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Job Form ────────────────────────────────────────────

type CreateMode = "paste" | "manual";

function CreateJobForm({
  onCreated,
  onCancel,
}: {
  onCreated: (job: Job) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<CreateMode>("paste");
  const [rawContent, setRawContent] = useState("");
  const [company, setCompany] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    if (mode === "paste" && !rawContent.trim()) {
      setError("Paste the job page content first.");
      return;
    }
    if (mode === "manual" && !company.trim() && !role.trim()) {
      setError("Enter at least a company name or role.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const body =
        mode === "paste"
          ? { mode: "paste", raw_content: rawContent }
          : { mode: "manual", company, company_url: companyUrl, role, job_url: jobUrl, description };

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to create job.");
        return;
      }

      const { job } = await res.json();
      onCreated(job);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [mode, rawContent, company, companyUrl, role, jobUrl, description, onCreated]);

  const inputCls = "w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1b2a4a]/20 focus:border-[#1b2a4a]";
  const labelCls = "block text-xs font-medium text-gray-600 mb-0.5";

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">New Job</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xs">
          Cancel
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
        {(["paste", "manual"] as CreateMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 transition-colors ${
              mode === m ? "bg-[#1b2a4a] text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m === "paste" ? "Paste Content" : "Manual Entry"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div>
          <label className={labelCls}>Paste job page content (LinkedIn, job board, etc.)</label>
          <textarea
            className={inputCls + " h-36 resize-none font-mono text-xs"}
            placeholder="Copy the full job page text and paste it here…"
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Company</label>
              <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Engineer" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Company URL</label>
            <input className={inputCls} value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://acme.com" />
          </div>
          <div>
            <label className={labelCls}>Job URL</label>
            <input className={inputCls} value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>Job Description</label>
            <textarea
              className={inputCls + " h-28 resize-none text-xs"}
              placeholder="Paste or type the job description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2 bg-[#1b2a4a] text-white rounded-lg text-sm font-medium hover:bg-[#253d6e] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {loading ? "Extracting with AI…" : "Create Job"}
      </button>
    </div>
  );
}

// ── Job Detail View ────────────────────────────────────────────

function JobDetailView({
  job,
  active,
  onActivate,
  onJobUpdated,
}: {
  job: Job;
  active: boolean;
  onActivate: () => void;
  onJobUpdated: (updated: Job) => void;
}) {
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    setStatus(newStatus);
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const { job: updated } = await res.json();
        onJobUpdated(updated);
      } else {
        setStatus(job.status);
      }
    } catch {
      setStatus(job.status);
    } finally {
      setSaving(false);
    }
  }, [job.id, job.status, onJobUpdated]);

  return (
    <div className="p-4 space-y-4">
      {!active ? (
        <button
          type="button"
          onClick={onActivate}
          className="w-full py-2 bg-[#1b2a4a] text-white rounded-lg text-sm font-medium hover:bg-[#253d6e] transition-colors"
        >
          Edit CV for this job
        </button>
      ) : (
        <div className="w-full py-2 text-center text-xs text-[#1b2a4a] font-semibold bg-[#1b2a4a]/5 rounded-lg border border-[#1b2a4a]/20">
          ✓ Currently editing this job&apos;s CV
        </div>
      )}

      <SummaryCard summary={job.summary} />

      <div>
        <div className="text-xs font-medium text-gray-600 mb-1.5">Application Status</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABELS) as JobStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              disabled={saving}
              className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                status === s
                  ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current/30"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">Job Info</div>
        {job.company && (
          <div>
            <div className="text-xs text-gray-400">Company</div>
            <div className="text-xs text-gray-700 font-medium">{job.company}</div>
          </div>
        )}
        {job.role && (
          <div>
            <div className="text-xs text-gray-400">Role</div>
            <div className="text-xs text-gray-700">{job.role}</div>
          </div>
        )}
        {job.job_url && (
          <div>
            <div className="text-xs text-gray-400">Job URL</div>
            <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
              {job.job_url}
            </a>
          </div>
        )}
        {job.company_url && (
          <div>
            <div className="text-xs text-gray-400">Company URL</div>
            <a href={job.company_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
              {job.company_url}
            </a>
          </div>
        )}
        {job.description && (
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Description</div>
            <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {job.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main JobPanel ──────────────────────────────────────────────

export function JobPanel({
  open,
  onToggle,
  jobs,
  activeJobId,
  onSelectJob,
  onJobsChanged,
}: {
  open: boolean;
  onToggle: () => void;
  jobs: JobListItem[];
  activeJobId: number | null;
  onSelectJob: (id: number | null) => void;
  onJobsChanged: () => void;
}) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleDelete = useCallback(async (jobId: number) => {
    if (!confirm("Delete this job and all its CV versions?")) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) return;
    if (activeJobId === jobId) onSelectJob(null);
    onJobsChanged();
    setView("list");
    setSelectedJob(null);
  }, [activeJobId, onSelectJob, onJobsChanged]);

  const handleSelectJob = useCallback(async (jobId: number) => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) {
      setSelectedJob(await res.json());
      setView("detail");
    }
  }, []);

  const handleJobCreated = useCallback((job: Job) => {
    onJobsChanged();
    setSelectedJob(job);
    setView("detail");
  }, [onJobsChanged]);

  // ── Collapsed icon rail ──────────────────────────────────────

  if (!open) {
    return (
      <div className="hidden lg:flex flex-col w-12 shrink-0 bg-[#1b2a4a] h-full">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="h-12 flex items-center justify-center w-full text-white/50 hover:text-white transition-colors border-b border-white/10 shrink-0"
          title="Expand jobs panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Icons */}
        <div className="flex flex-col items-center gap-1 pt-2 px-1.5 flex-1 overflow-y-auto">
          {/* General CV */}
          <button
            type="button"
            onClick={() => onSelectJob(null)}
            title="General CV"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              activeJobId === null
                ? "bg-white text-[#1b2a4a] shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {jobs.length > 0 && (
            <div className="w-5 h-px bg-white/15 my-0.5" />
          )}

          {/* Job icons */}
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelectJob(job.id)}
              title={`${job.company || "Untitled"} — ${job.role}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${ICON_COLORS[job.status]} ${
                activeJobId === job.id ? "ring-2 ring-white ring-offset-1 ring-offset-[#1b2a4a]" : ""
              }`}
            >
              {(job.company?.[0] || "?").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Add job */}
        <div className="p-1.5 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => { onToggle(); setView("create"); }}
            title="Add job"
            className="w-8 h-8 rounded-lg bg-white/15 text-white hover:bg-white/25 flex items-center justify-center mx-auto transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────

  return (
    <div className="hidden lg:flex flex-col w-[280px] shrink-0 bg-white border-r border-gray-200 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 shrink-0 h-12">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <button
              type="button"
              onClick={() => { setView("list"); setSelectedJob(null); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="font-semibold text-gray-800 text-sm">
            {view === "list" ? "Jobs" : view === "create" ? "New Job" : selectedJob?.company || "Job Detail"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600"
          title="Collapse"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === "list" && (
          <div className="p-4">
            {/* General option */}
            <div
              className={`border rounded-xl p-3 mb-3 cursor-pointer transition-all duration-150 ${
                activeJobId === null
                  ? "border-[#1b2a4a] bg-[#1b2a4a]/5"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              onClick={() => onSelectJob(null)}
            >
              <div className="font-semibold text-sm text-gray-800">General CV</div>
              <div className="text-xs text-gray-500">Default, non-job-specific versions</div>
            </div>

            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Jobs ({jobs.length})
            </div>

            {jobs.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No jobs yet. Add one below.</p>
            )}

            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                active={activeJobId === job.id}
                onSelect={() => handleSelectJob(job.id)}
                onDelete={() => handleDelete(job.id)}
              />
            ))}
          </div>
        )}

        {view === "create" && (
          <CreateJobForm
            onCreated={handleJobCreated}
            onCancel={() => setView("list")}
          />
        )}

        {view === "detail" && selectedJob && (
          <JobDetailView
            job={selectedJob}
            active={activeJobId === selectedJob.id}
            onActivate={() => onSelectJob(selectedJob.id)}
            onJobUpdated={(updated) => {
              setSelectedJob(updated);
              onJobsChanged();
            }}
          />
        )}
      </div>

      {/* Footer — Add Job */}
      {view === "list" && (
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => setView("create")}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#1b2a4a] hover:text-[#1b2a4a] transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Job
          </button>
        </div>
      )}
    </div>
  );
}
