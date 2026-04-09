import { useRef, useState } from "react";
import type { CvData, PdfOptions, PdfPageBreaks } from "./types";

// ── Defaults (must mirror DEFAULT_PDF_OPTS in build_cv.py) ────

const DEFAULTS: Required<PdfOptions> = {
  marginLR: 22,
  marginTop: 18,
  marginBottom: 18,
  sectionSpacing: 5.5,
  fontSizeName: 26,
  fontSizeContactTitle: 11,
  fontSizeBody: 9.5,
  fontSizeSection: 9.5,
  fontSizeTitle: 10.5,
  mergeSummarySkills: false,
  mergeSummarySkillsSpacing: 3,
  hiddenSections: [],
  hiddenTitles: [],
  pageBreaks: {},
};

const SECTION_LABELS: Record<string, string> = {
  skills: "Skills",
  achievements: "Achievements",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  interests: "Interests",
};

// All section keys that can have their PDF title suppressed (summary is pinned, not in sectionOrder)
const ALL_TITLE_SECTIONS = ["summary", "skills", "achievements", "experience", "projects", "education", "interests"];

interface OptionsPanelProps {
  open: boolean;
  onClose: () => void;
  data: CvData;
  update: (fn: (d: CvData) => void) => void;
}

function NumInput({
  label,
  value,
  defaultVal,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number | undefined;
  defaultVal: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const effective = value ?? defaultVal;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 text-gray-600 shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={effective}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-[#1b2a4a] focus:ring-1 focus:ring-[#1b2a4a]/20"
      />
      <span className="text-xs text-gray-400">{unit}</span>
    </label>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && <div className="pb-4 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

export function OptionsPanel({ open, onClose, data, update }: OptionsPanelProps) {
  const opts = data.pdfOptions ?? {};
  const dragSrcRef = useRef<string | null>(null);

  function setOpt<K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) {
    update((d) => {
      if (!d.pdfOptions) d.pdfOptions = {};
      (d.pdfOptions as Record<string, unknown>)[key] = value;
    });
  }

  function toggleHiddenSection(key: string) {
    const current = opts.hiddenSections ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setOpt("hiddenSections", next);
  }

  function toggleHiddenTitle(key: string) {
    const current = opts.hiddenTitles ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setOpt("hiddenTitles", next);
  }

  const sectionOrder = data.sectionOrder ?? ["skills", "achievements", "experience", "projects", "education", "interests"];

  function handleDragStart(key: string) {
    dragSrcRef.current = key;
  }

  function handleDrop(targetKey: string) {
    const src = dragSrcRef.current;
    if (!src || src === targetKey) return;
    update((d) => {
      const order = [...(d.sectionOrder ?? ["skills", "achievements", "experience", "projects", "education", "interests"])];
      const from = order.indexOf(src);
      const to = order.indexOf(targetKey);
      if (from === -1 || to === -1) return;
      order.splice(from, 1);
      order.splice(to, 0, src);
      d.sectionOrder = order;
    });
    dragSrcRef.current = null;
  }

  function setPageBreak(section: keyof PdfPageBreaks, index: number, on: boolean) {
    update((d) => {
      if (!d.pdfOptions) d.pdfOptions = {};
      if (!d.pdfOptions.pageBreaks) d.pdfOptions.pageBreaks = {};
      const current: number[] = d.pdfOptions.pageBreaks[section] ?? [];
      d.pdfOptions.pageBreaks[section] = on
        ? [...current.filter((i) => i !== index), index]
        : current.filter((i) => i !== index);
    });
  }

  function hasPageBreak(section: keyof PdfPageBreaks, index: number): boolean {
    return (opts.pageBreaks?.[section] ?? []).includes(index);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[340px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#1b2a4a] text-white shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold">PDF Options</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-2">

          <SubSection title="Layout">
            <NumInput label="Margin left/right" value={opts.marginLR} defaultVal={DEFAULTS.marginLR} min={5} max={40} step={1} unit="mm" onChange={(v) => setOpt("marginLR", v)} />
            <NumInput label="Margin top" value={opts.marginTop} defaultVal={DEFAULTS.marginTop} min={5} max={40} step={1} unit="mm" onChange={(v) => setOpt("marginTop", v)} />
            <NumInput label="Margin bottom" value={opts.marginBottom} defaultVal={DEFAULTS.marginBottom} min={5} max={40} step={1} unit="mm" onChange={(v) => setOpt("marginBottom", v)} />
            <NumInput label="Section spacing" value={opts.sectionSpacing} defaultVal={DEFAULTS.sectionSpacing} min={0} max={20} step={0.5} unit="mm" onChange={(v) => setOpt("sectionSpacing", v)} />
          </SubSection>

          <SubSection title="Font Sizes">
            <NumInput label="Name" value={opts.fontSizeName} defaultVal={DEFAULTS.fontSizeName} min={16} max={40} step={0.5} unit="pt" onChange={(v) => setOpt("fontSizeName", v)} />
            <NumInput label="Title / role" value={opts.fontSizeContactTitle} defaultVal={DEFAULTS.fontSizeContactTitle} min={6} max={20} step={0.5} unit="pt" onChange={(v) => setOpt("fontSizeContactTitle", v)} />
            <NumInput label="Body / bullets" value={opts.fontSizeBody} defaultVal={DEFAULTS.fontSizeBody} min={6} max={14} step={0.5} unit="pt" onChange={(v) => setOpt("fontSizeBody", v)} />
            <NumInput label="Section header" value={opts.fontSizeSection} defaultVal={DEFAULTS.fontSizeSection} min={6} max={14} step={0.5} unit="pt" onChange={(v) => setOpt("fontSizeSection", v)} />
            <NumInput label="Item title" value={opts.fontSizeTitle} defaultVal={DEFAULTS.fontSizeTitle} min={6} max={16} step={0.5} unit="pt" onChange={(v) => setOpt("fontSizeTitle", v)} />
          </SubSection>

          <SubSection title="Sections">
            <p className="text-xs text-gray-400 mb-1">Drag to reorder. Toggle to show/hide in PDF.</p>
            {sectionOrder.map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => handleDragStart(key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(key)}
                onDragEnd={() => { dragSrcRef.current = null; }}
              >
                <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
                <span className="flex-1 text-sm text-gray-700">{SECTION_LABELS[key] ?? key}</span>
                <label className="flex items-center gap-1 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="accent-[#1b2a4a]"
                    checked={!(opts.hiddenSections ?? []).includes(key)}
                    onChange={() => toggleHiddenSection(key)}
                  />
                  <span className="text-xs text-gray-400">show</span>
                </label>
              </div>
            ))}
          </SubSection>

          <SubSection title="Section Titles">
            <p className="text-xs text-gray-400 mb-1">Uncheck to hide the heading text + line from PDF.</p>
            {ALL_TITLE_SECTIONS.map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none py-0.5">
                <input
                  type="checkbox"
                  className="accent-[#1b2a4a]"
                  checked={!(opts.hiddenTitles ?? []).includes(key)}
                  onChange={() => toggleHiddenTitle(key)}
                />
                <span className="text-sm text-gray-700">{key === "summary" ? "Summary" : SECTION_LABELS[key] ?? key}</span>
              </label>
            ))}
          </SubSection>

          <SubSection title="Custom">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-[#1b2a4a]"
                checked={!!opts.mergeSummarySkills}
                onChange={(e) => setOpt("mergeSummarySkills", e.target.checked)}
              />
              <span className="text-sm text-gray-700">Merge Summary &amp; Skills</span>
            </label>
            <p className="text-xs text-gray-400 ml-5">Skills render directly under Summary with no Skills header.</p>
            {opts.mergeSummarySkills && (
              <div className="ml-5">
                <NumInput
                  label="Summary→Skills gap"
                  value={opts.mergeSummarySkillsSpacing}
                  defaultVal={DEFAULTS.mergeSummarySkillsSpacing}
                  min={0}
                  max={20}
                  step={0.5}
                  unit="mm"
                  onChange={(v) => setOpt("mergeSummarySkillsSpacing", v)}
                />
              </div>
            )}
          </SubSection>

          <SubSection title="Page Breaks">
            <p className="text-xs text-gray-400 mb-1">Insert a page break after the selected item.</p>

            {/* Skills */}
            {data.skills.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Skills</p>
                {data.skills.map((skill, si) => (
                  <label key={si} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                    <input type="checkbox" className="accent-[#1b2a4a]"
                      checked={!!skill.pageBreakAfter}
                      onChange={(e) => update((d) => { d.skills[si].pageBreakAfter = e.target.checked; })}
                    />
                    <span className="text-sm text-gray-700 leading-tight">After: {skill.label || `Skill ${si + 1}`}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Achievements */}
            {(data.achievements ?? []).length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Achievements</p>
                {(data.achievements ?? []).map((ach, ai) => (
                  <label key={ai} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                    <input type="checkbox" className="accent-[#1b2a4a]"
                      checked={hasPageBreak("achievements", ai)}
                      onChange={(e) => setPageBreak("achievements", ai, e.target.checked)}
                    />
                    <span className="text-sm text-gray-700 leading-tight truncate max-w-[240px]" title={ach}>
                      After: {ach.length > 50 ? ach.slice(0, 50) + "…" : ach}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Experience */}
            {data.experience.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Experience</p>
                {data.experience.map((exp, ei) => (
                  <div key={ei} className="mb-1">
                    {exp.roles.map((role, ri) => (
                      <label key={ri} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                        <input type="checkbox" className="accent-[#1b2a4a]"
                          checked={!!role.pageBreakAfter}
                          onChange={(e) => update((d) => { d.experience[ei].roles[ri].pageBreakAfter = e.target.checked; })}
                        />
                        <span className="text-sm text-gray-700 leading-tight">After: {exp.company} — {role.title}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                      <input type="checkbox" className="accent-[#1b2a4a]"
                        checked={!!exp.pageBreakAfter}
                        onChange={(e) => update((d) => { d.experience[ei].pageBreakAfter = e.target.checked; })}
                      />
                      <span className="text-sm text-gray-500 leading-tight italic">After all of {exp.company}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {/* Projects */}
            {data.projects.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Projects</p>
                {data.projects.map((proj, pi) => (
                  <label key={pi} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                    <input type="checkbox" className="accent-[#1b2a4a]"
                      checked={!!proj.pageBreakAfter}
                      onChange={(e) => update((d) => { d.projects[pi].pageBreakAfter = e.target.checked; })}
                    />
                    <span className="text-sm text-gray-700 leading-tight">After: {proj.name || `Project ${pi + 1}`}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Education */}
            {data.education.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Education</p>
                {data.education.map((edu, ei) => (
                  <label key={ei} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                    <input type="checkbox" className="accent-[#1b2a4a]"
                      checked={!!edu.pageBreakAfter}
                      onChange={(e) => update((d) => { d.education[ei].pageBreakAfter = e.target.checked; })}
                    />
                    <span className="text-sm text-gray-700 leading-tight">After: {edu.institution || `Education ${ei + 1}`}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Interests */}
            {(data.interests ?? []).length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Interests</p>
                {(data.interests ?? []).map((interest, ii) => (
                  <label key={ii} className="flex items-center gap-2 cursor-pointer select-none py-0.5 pl-2">
                    <input type="checkbox" className="accent-[#1b2a4a]"
                      checked={hasPageBreak("interests", ii)}
                      onChange={(e) => setPageBreak("interests", ii, e.target.checked)}
                    />
                    <span className="text-sm text-gray-700 leading-tight truncate max-w-[240px]" title={interest}>
                      After: {interest.length > 50 ? interest.slice(0, 50) + "…" : interest}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </SubSection>

        </div>
      </div>
    </>
  );
}
