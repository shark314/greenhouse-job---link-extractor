export interface ExtractedLink {
  url: string;
  text: string;
  type: "apply" | "email" | "form" | "document" | "external" | "meeting" | "social";
  context?: string;
}

export interface ArchiveSnapshot {
  timestamp: string;
  original: string;
  statuscode: string;
  mimetype: string;
  archiveUrl: string;
  rawContentUrl: string;
}

export interface GreenhouseJob {
  id?: string | number;
  title?: string;
  location?: { name: string };
  updated_at?: string;
  absolute_url?: string;
  content?: string;
  departments?: Array<{ id: number; name: string }>;
  offices?: Array<{ id: number; name: string; location: string }>;
  isArchived?: boolean;
  archiveUrl?: string;
  timestamp?: string;
  metadata?: any[];
}

export interface FetchResult {
  board: string;
  jobId: string | null;
  status: "active_api" | "active_api_list" | "archived_recovered" | "not_found_or_expired" | "unknown";
  source: "greenhouse_api" | "greenhouse_all_jobs_api" | "wayback_machine" | "none";
  job: GreenhouseJob | null;
  links: ExtractedLink[];
  rawHtml: string;
  plainText: string;
  archiveSnapshots: ArchiveSnapshot[];
  apiEndpoints: {
    jobApi: string | null;
    boardAllJobsApi: string;
    boardDepartmentsApi: string;
  };
  totalActiveBoardJobs?: number;
  sampleActiveJobs?: Array<{
    id: string | number;
    title: string;
    location?: string;
    updated_at?: string;
    absolute_url?: string;
  }>;
  archiveTimestamp?: string;
  archiveUrl?: string;
  googleSearchUrls?: string[];
  waybackSearchUrl?: string;
  error?: string;
}
