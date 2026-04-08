// Existing CV types
export type PeriodDate = { year: number; month: number };
export type Period = { start: PeriodDate; end: PeriodDate | "present" };

export interface Contact {
  name: string;
  title?: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  github: string;
}

export interface Role {
  title: string;
  period: Period;
  description: string;
}

export interface Experience {
  company: string;
  roles: Role[];
  pageBreakAfter?: boolean;
}

export interface Project {
  name: string;
  description: string;
  pageBreakAfter?: boolean;
}

export interface Education {
  institution: string;
  degree?: string;
  period: Period;
  focus: string[];
  pageBreakAfter?: boolean;
}

export interface Skill {
  label: string;
  items: string;
}

export interface PdfOptions {
  // Layout (mm)
  marginLR?: number;        // default 22
  marginTop?: number;       // default 18
  marginBottom?: number;    // default 18
  sectionSpacing?: number;  // default 5.5 — space before each section header

  // Font sizes (pt)
  fontSizeName?: number;    // default 26 — name heading
  fontSizeBody?: number;    // default 9.5 — body text, bullets, summary
  fontSizeSection?: number; // default 9.5 — section header caps
  fontSizeTitle?: number;   // default 10.5 — exp/edu/proj title lines

  // Custom
  mergeSummarySkills?: boolean;  // render skills immediately under summary, no Skills header
  hiddenSections?: string[];     // section keys to skip entirely in PDF
  hiddenTitles?: string[];       // section keys where the header title+line is suppressed
}

export interface CvData {
  contact: Contact;
  summary: string;
  skills: Skill[];
  achievements?: string[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  interests: string[];
  sectionOrder?: string[];
  pdfOptions?: PdfOptions;
}

export interface VersionSummary {
  id: number;
  created_at: string;
  source: string;
}

// Job types
export interface JobSummary {
  tech_skills: string[];
  other_skills: string[];
  key_points: string[];
}

export type JobStatus = "active" | "applied" | "interview" | "rejected" | "offered";

export interface Job {
  id: number;
  company: string;
  company_url: string;
  role: string;
  job_url: string;
  other_links: string[];
  description: string;
  raw_content: string;
  summary: JobSummary;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface JobListItem {
  id: number;
  company: string;
  role: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  summary: JobSummary;
}
