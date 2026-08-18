import React, { useState } from "react";
import { Code2, Copy, Check, Download, Terminal, Bookmark, FileCode, CheckCircle2, Play } from "lucide-react";
import {
  generatePythonScript,
  generateNodeScript,
  generateCurlCommand,
  generateBookmarklet,
} from "../utils/scriptGenerators";

interface ScriptsPanelProps {
  board: string;
  jobId: string | null;
}

export const ScriptsPanel: React.FC<ScriptsPanelProps> = ({ board, jobId }) => {
  const [activeTab, setActiveTab] = useState<"python" | "node" | "curl" | "bookmarklet">("python");
  const [copied, setCopied] = useState(false);

  const targetBoard = board || "synack";
  const targetJobId = jobId || "8023991";

  const getCode = () => {
    switch (activeTab) {
      case "python":
        return generatePythonScript(targetBoard, targetJobId);
      case "node":
        return generateNodeScript(targetBoard, targetJobId);
      case "curl":
        return generateCurlCommand(targetBoard, targetJobId);
      case "bookmarklet":
        return generateBookmarklet();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getCode();
    const filename =
      activeTab === "python"
        ? `greenhouse_${targetBoard}_${targetJobId}.py`
        : activeTab === "node"
        ? `greenhouse_${targetBoard}_${targetJobId}.js`
        : activeTab === "curl"
        ? `greenhouse_curl.sh`
        : `bookmarklet.js`;

    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Automated Extraction Scripts
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-mono font-medium">
                {targetBoard} {targetJobId}
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              Run standalone scripts in your terminal or browser bookmark bar without needing an extension
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
        </div>
      </div>

      {/* Language Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveTab("python")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition shadow-xs ${
            activeTab === "python"
              ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
              : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-600" />
          <span>Python (.py)</span>
        </button>

        <button
          onClick={() => setActiveTab("node")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition shadow-xs ${
            activeTab === "node"
              ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
              : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-green-600" />
          <span>Node.js ESM (.js)</span>
        </button>

        <button
          onClick={() => setActiveTab("curl")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition shadow-xs ${
            activeTab === "curl"
              ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
              : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-blue-600" />
          <span>cURL & jq CLI</span>
        </button>

        <button
          onClick={() => setActiveTab("bookmarklet")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition shadow-xs ${
            activeTab === "bookmarklet"
              ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
              : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 text-rose-500" />
          <span>1-Click Bookmarklet</span>
        </button>
      </div>

      {/* Bookmarklet Instructions if tab is bookmarklet */}
      {activeTab === "bookmarklet" && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>How to use the Bookmarklet:</span>
          </div>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Create a new bookmark in your browser (press <kbd className="bg-white border border-gray-200 px-1 py-0.5 rounded text-blue-800 shadow-2xs">Ctrl+D</kbd> or <kbd className="bg-white border border-gray-200 px-1 py-0.5 rounded text-blue-800 shadow-2xs">Cmd+D</kbd>).</li>
            <li>Edit the bookmark and paste the JavaScript code below into the <b>URL</b> field.</li>
            <li>Whenever you are on a Greenhouse page (or got redirected to a 404), click the bookmark. It renders a clean floating modal with the job description & extracted links!</li>
          </ol>
        </div>
      )}

      {/* Code Editor Preview */}
      <div className="relative rounded-xl border border-gray-800 bg-[#1E293B] shadow-xl overflow-hidden">
        <div className="bg-slate-900 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
            <span className="ml-2 text-gray-300 font-mono">
              {activeTab === "python"
                ? "greenhouse_extractor.py"
                : activeTab === "node"
                ? "extract.js"
                : activeTab === "curl"
                ? "command.sh"
                : "bookmarklet.js"}
            </span>
          </div>
          <span className="text-[11px] text-gray-500">UTF-8</span>
        </div>

        <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto max-h-96 leading-relaxed">
          <code>{getCode()}</code>
        </pre>
      </div>
    </div>
  );
};
