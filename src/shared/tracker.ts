export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export interface JobApplication {
  id: string;
  url: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  status: ApplicationStatus;
  summary: string;
  strengths: string[];
  missingKeywords: string[];
  notes: string;
  analyzedAt: string;
  updatedAt: string;
  appliedAt?: string;
}

export interface UpsertApplicationInput {
  url: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  summary: string;
  strengths: string[];
  missingKeywords: string[];
}

export interface UpdateApplicationPatch {
  id: string;
  status?: ApplicationStatus;
  notes?: string;
  appliedAt?: string | null;
  jobTitle?: string;
  company?: string;
}
