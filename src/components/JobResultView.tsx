import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Archive,
  Building2,
  MapPin,
  Calendar,
  Code2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Search,
  Globe,
  Share2,
  Clock,
  HelpCircle,
} from "lucide-react";
import { FetchResult } from "../types";
import { ExtractedLinksCard } from "./ExtractedLinksCard";

interface JobResultViewProps {
  result: FetchResult;
}

export const JobResultView: React.FC<JobResultViewProps> = ({ result }) => {
  const [activeTab, setActiveTab] = useState<"formatted" | "plain" | "json">("formatted");
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(result.plainText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const isLive = result.status === "active_api" || result.status === "active_api_list";
  const isArchived = result.status === "archived_recovered";
  const isNotFound = result.status === "not_found_or_expired";

  return (
    <div className="space-y-6">
      {/* Top Status Banner */}
      {isLive && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0 border border-green-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-base">Active Live Job Found</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200 font-medium">
                  {result.source === "greenhouse_api" ? "Direct API v1" : "Board Feed API"}
                </span>
              </div>
              <p className="text-xs text-green-800 mt-0.5">
                Successfully queried <code className="font-mono bg-green-100/70 px-1 py-0.5 rounded text-green-900">boards-api.greenhouse.io</code> without CORS or redirect blocks.
              </p>
            </div>
          </div>
          {result.job?.absolute_url && (
            <a
              href={result.job.absolute_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shrink-0 transition shadow-xs"
            >
              <span>View On Greenhouse</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {isArchived && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-base">Recovered from Wayback Machine Archive</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                  Snapshot: {result.archiveTimestamp || "Archived"}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                This job posting is unlisted/redirecting on Greenhouse. We retrieved the historical Wayback snapshot and extracted all links!
              </p>
            </div>
          </div>
          {result.archiveUrl && (
            <a
              href={result.archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shrink-0 transition shadow-xs"
            >
              <span>Open Wayback Snapshot</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {isNotFound && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
              <XCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 text-base">
                Job #{result.jobId} Not Published or Removed
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                When Greenhouse returns a 404 or redirects to the company careers list, the job has typically been unpublished, expired, or filled. It was not found in the live API or current archive snapshots.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Alternative Search & Diagnostic Queries:
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.googleSearchUrls?.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-mono border border-gray-200 transition shadow-xs"
                >
                  <Search className="w-3.5 h-3.5 text-blue-600" />
                  <span>Google Cache Query #{idx + 1}</span>
                </a>
              ))}
              {result.waybackSearchUrl && (
                <a
                  href={result.waybackSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-amber-800 text-xs font-mono border border-gray-200 transition shadow-xs"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Search All Wayback Dates</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role Title & Meta Card */}
      {result.job && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                  Board: {result.board}
                </span>
                {result.jobId && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                    ID: {result.jobId}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {result.job.title || `Job #${result.jobId}`}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>{result.job.location?.name || "Location N/A"}</span>
              </div>
              {result.job.updated_at && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Updated: {new Date(result.job.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Links Card */}
      <ExtractedLinksCard
        links={result.links}
        jobTitle={result.job?.title}
        source={result.source}
      />

      {/* Job Description Content Viewer */}
      {result.plainText && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Job Description Body
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                <button
                  onClick={() => setActiveTab("formatted")}
                  className={`px-3 py-1 rounded-md transition ${
                    activeTab === "formatted"
                      ? "bg-white text-blue-600 font-semibold shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Formatted HTML
                </button>
                <button
                  onClick={() => setActiveTab("plain")}
                  className={`px-3 py-1 rounded-md transition ${
                    activeTab === "plain"
                      ? "bg-white text-blue-600 font-semibold shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Plain Text
                </button>
                <button
                  onClick={() => setActiveTab("json")}
                  className={`px-3 py-1 rounded-md transition ${
                    activeTab === "json"
                      ? "bg-white text-blue-600 font-semibold shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Raw JSON API
                </button>
              </div>

              {activeTab === "plain" && (
                <button
                  onClick={handleCopyText}
                  className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-xs transition"
                  title="Copy Plain Text"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}

              {activeTab === "json" && (
                <button
                  onClick={handleCopyJson}
                  className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-xs transition"
                  title="Copy Raw JSON"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div>
            {activeTab === "formatted" && (
              <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 max-h-[500px] overflow-y-auto">
                <div
                  className="text-gray-800 text-sm leading-relaxed space-y-3 prose prose-slate max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800"
                  dangerouslySetInnerHTML={{ __html: result.rawHtml || result.plainText }}
                />
              </div>
            )}

            {activeTab === "plain" && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 max-h-[500px] overflow-y-auto">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {result.plainText}
                </pre>
              </div>
            )}

            {activeTab === "json" && (
              <div className="bg-[#1E293B] rounded-xl shadow-xl p-5 font-mono text-xs overflow-hidden relative">
                <div className="flex items-center space-x-2 mb-3 border-b border-gray-700 pb-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="ml-3 text-gray-400 text-xs">greenhouse_response.json</span>
                </div>
                <pre className="text-blue-300 max-h-[450px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Jobs on Board Sample (if available) */}
      {result.sampleActiveJobs && result.sampleActiveJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Other Active Jobs on '{result.board}' ({result.totalActiveBoardJobs || result.sampleActiveJobs.length} active)
              </h3>
            </div>
            <a
              href={`https://boards-api.greenhouse.io/v1/boards/${result.board}/jobs?content=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View All JSON Feed</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {result.sampleActiveJobs.map((j) => (
              <div
                key={j.id}
                className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-white flex items-center justify-between gap-2 shadow-xs transition"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{j.title}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    📍 {j.location || "Remote"} | ID: {j.id}
                  </p>
                </div>
                {j.absolute_url && (
                  <a
                    href={j.absolute_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 shadow-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
