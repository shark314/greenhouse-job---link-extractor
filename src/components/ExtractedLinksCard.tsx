import React, { useState } from "react";
import { Link2, ExternalLink, Copy, Check, Filter, Mail, FileText, Calendar, Send, Compass, Search } from "lucide-react";
import { ExtractedLink } from "../types";

interface ExtractedLinksCardProps {
  links: ExtractedLink[];
  jobTitle?: string;
  source?: string;
}

export const ExtractedLinksCard: React.FC<ExtractedLinksCardProps> = ({ links, jobTitle, source }) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const filteredLinks = links.filter((link) => {
    const matchesType = filterType === "all" || link.type === filterType;
    const matchesSearch =
      searchQuery === "" ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleCopyAll = () => {
    const text = links.map((l, i) => `[${i + 1}] ${l.type.toUpperCase()}: ${l.text} -> ${l.url}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getTypeBadge = (type: ExtractedLink["type"]) => {
    switch (type) {
      case "apply":
        return {
          icon: <Send className="w-3 h-3" />,
          label: "Apply Portal",
          className: "bg-green-50 text-green-700 border-green-200",
        };
      case "email":
        return {
          icon: <Mail className="w-3 h-3" />,
          label: "Email / Mailto",
          className: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "form":
        return {
          icon: <FileText className="w-3 h-3" />,
          label: "Form / Survey",
          className: "bg-purple-50 text-purple-700 border-purple-200",
        };
      case "meeting":
        return {
          icon: <Calendar className="w-3 h-3" />,
          label: "Meeting / Calendly",
          className: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "document":
        return {
          icon: <FileText className="w-3 h-3" />,
          label: "Doc / PDF",
          className: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "social":
        return {
          icon: <Compass className="w-3 h-3" />,
          label: "Social / Profile",
          className: "bg-cyan-50 text-cyan-700 border-cyan-200",
        };
      default:
        return {
          icon: <Link2 className="w-3 h-3" />,
          label: "External URL",
          className: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Extracted Links from Description
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-mono font-medium">
                {links.length} found
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              Direct application URLs, recruiter contacts, questionnaires & external resources
            </p>
          </div>
        </div>

        {links.length > 0 && (
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-xs transition shrink-0"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            <span>{copiedAll ? "Copied All Links!" : "Copy All Links"}</span>
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <Link2 className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-gray-600 font-medium">No embedded links detected in this job content.</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            The job description body does not contain hyperlinks, mailto links, or raw URL strings.
          </p>
        </div>
      ) : (
        <>
          {/* Controls: Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search extracted links or anchor text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {["all", "apply", "email", "form", "meeting", "document", "external"].map((type) => {
                const count = type === "all" ? links.length : links.filter((l) => l.type === type).length;
                if (count === 0 && type !== "all") return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize border transition shadow-xs ${
                      filterType === type
                        ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {type} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Links List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredLinks.map((link, idx) => {
              const badge = getTypeBadge(link.type);
              const isCopied = copiedUrl === link.url;
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 p-3 bg-gray-50 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition group shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-gray-400 font-mono text-xs mt-0.5">{idx + 1}.</span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium font-mono px-2 py-0.5 rounded border ${badge.className}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-xs font-medium text-gray-800 truncate max-w-xs sm:max-w-md">
                          {link.text}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-blue-600 hover:text-blue-700 break-all select-all">
                        {link.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleCopy(link.url)}
                      title="Copy URL"
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 shadow-xs transition"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open link in new tab"
                      className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-xs transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
