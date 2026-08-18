import React, { useState } from "react";
import { Sparkles, Send, MessageSquare, Briefcase, Mail, Check, Copy, RefreshCw, Layers } from "lucide-react";
import { ExtractedLink } from "../types";

interface LinkIntelligenceAiProps {
  jobTitle?: string;
  board?: string;
  plainText?: string;
  links?: ExtractedLink[];
}

export const LinkIntelligenceAi: React.FC<LinkIntelligenceAiProps> = ({
  jobTitle,
  board,
  plainText,
  links = [],
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<"summarize_links" | "outreach_letter" | "skill_matrix">("summarize_links");
  const [copied, setCopied] = useState(false);

  const handleRunAi = async (mode: "summarize_links" | "outreach_letter" | "skill_matrix") => {
    if (!plainText) return;
    setIsLoading(true);
    setActiveMode(mode);

    try {
      const resp = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: plainText,
          links,
          jobTitle: jobTitle || "Unknown Position",
          company: board || "Company",
          mode,
        }),
      });

      const data = await resp.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis("Could not generate analysis: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      setAnalysis("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (analysis) {
      navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Gemini AI Intelligence & Outreach Assistant
            </h3>
            <p className="text-xs text-gray-500">
              Analyze extracted links, audit requirements, or draft cold recruiter emails
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleRunAi("summarize_links")}
            disabled={isLoading || !plainText}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition shadow-xs ${
              activeMode === "summarize_links" && analysis
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Audit Links & Role</span>
          </button>

          <button
            onClick={() => handleRunAi("outreach_letter")}
            disabled={isLoading || !plainText}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition shadow-xs ${
              activeMode === "outreach_letter" && analysis
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Recruiter Outreach Letter</span>
          </button>

          <button
            onClick={() => handleRunAi("skill_matrix")}
            disabled={isLoading || !plainText}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition shadow-xs ${
              activeMode === "skill_matrix" && analysis
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Skill Matrix</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center space-y-2 bg-gray-50 rounded-lg border border-gray-200">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-medium text-gray-700">Gemini 3.7 Flash is analyzing job description & links...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
              AI Generated Insights
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
            >
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy AI Output"}</span>
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
            <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-xs font-bold text-blue-800 uppercase mb-1">Quick Tip</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Click any button above to generate structured role intelligence, audit the {links.length} extracted hyperlinks, or draft an outreach message.
          </p>
        </div>
      )}
    </div>
  );
};
