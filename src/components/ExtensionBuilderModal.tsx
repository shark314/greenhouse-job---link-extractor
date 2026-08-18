import React, { useState } from "react";
import { X, Sparkles, Copy, Check, Download, Layers, ShieldCheck, Monitor, Command, FileCode, FolderArchive } from "lucide-react";
import { EXTENSION_FILES } from "../utils/scriptGenerators";
import { downloadExtensionZip } from "../utils/extensionZip";

interface ExtensionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionBuilderModal: React.FC<ExtensionBuilderModalProps> = ({ isOpen, onClose }) => {
  const [activeFile, setActiveFile] = useState<keyof typeof EXTENSION_FILES>("manifest");
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  if (!isOpen) return null;

  const currentContent = EXTENSION_FILES[activeFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const filenameMap: Record<keyof typeof EXTENSION_FILES, string> = {
      manifest: "manifest.json",
      contentScript: "content.js",
      stylesCss: "styles.css",
      popupHtml: "popup.html",
      popupJs: "popup.js",
    };
    const filename = filenameMap[activeFile];
    const blob = new Blob([currentContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = async () => {
    setDownloadingZip(true);
    try {
      await downloadExtensionZip();
      setTimeout(() => setDownloadingZip(false), 2000);
    } catch (e) {
      console.error(e);
      setDownloadingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Non-Sidebar Chrome Extension (Manifest V3)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                  Zero Sidebar Conflicts
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Auto-reads job links with zero typing and displays descriptions & links in-page without using sidebars
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllZip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
            >
              {downloadingZip ? <Check className="w-3.5 h-3.5" /> : <FolderArchive className="w-3.5 h-3.5" />}
              <span>{downloadingZip ? "Downloaded ZIP!" : "Download Extension (.ZIP)"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Architecture Strategy Callout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                <Monitor className="w-4 h-4 text-blue-600" />
                <span>1. Zero Input Needed</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug">
                Parses the company board & job ID straight from <code className="text-blue-600 bg-blue-50 px-1 rounded font-mono">window.location.href</code> on load.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                <Command className="w-4 h-4 text-blue-600" />
                <span>2. In-Page HUD (No Sidebar)</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug">
                Leaves your existing sidebar extensions completely untouched by rendering as a sleek in-page card.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>3. Wayback Auto-Fallback</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug">
                If the posting returns 404 or redirects to homepage, automatically queries Wayback Archive to restore text & links.
              </p>
            </div>
          </div>

          {/* Tabbed File Switcher & Code Viewer */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "manifest", label: "manifest.json" },
                  { key: "contentScript", label: "content.js" },
                  { key: "stylesCss", label: "styles.css" },
                  { key: "popupHtml", label: "popup.html" },
                  { key: "popupJs", label: "popup.js" },
                ].map((file) => (
                  <button
                    key={file.key}
                    onClick={() => setActiveFile(file.key as keyof typeof EXTENSION_FILES)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition shadow-xs ${
                      activeFile === file.key
                        ? "bg-blue-600 text-white font-semibold"
                        : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {file.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-xs transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                  <span>{copied ? "Copied" : "Copy File"}</span>
                </button>
                <button
                  onClick={handleDownloadSingle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Download File</span>
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="rounded-xl border border-gray-800 bg-[#1E293B] shadow-xl overflow-hidden">
              <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto max-h-80 leading-relaxed">
                <code>{currentContent}</code>
              </pre>
            </div>
          </div>

          {/* 3-Step Installation Guide */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2 font-mono">
              <FileCode className="w-4 h-4 text-blue-600" />
              Quick 30-Second Chrome Installation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1 shadow-xs">
                <span className="font-semibold text-gray-900">Step 1: Download & Unzip</span>
                <p className="text-[11px] text-gray-600">
                  Click the <b>Download Extension (.ZIP)</b> button above and extract the folder on your computer.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1 shadow-xs">
                <span className="font-semibold text-gray-900">Step 2: Enable Developer Mode</span>
                <p className="text-[11px] text-gray-600">
                  Open Chrome and navigate to <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono">chrome://extensions</code>. Toggle on <b>Developer mode</b> at top right.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1 shadow-xs">
                <span className="font-semibold text-gray-900">Step 3: Load Unpacked</span>
                <p className="text-[11px] text-gray-600">
                  Click <b>Load unpacked</b> and select the extracted folder. Now open any Greenhouse job URL to see it extract automatically!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Works on all <code className="text-blue-600 font-mono">*.greenhouse.io</code> job pages & redirected URLs.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllZip}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
            >
              Download Full Extension (.ZIP)
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium shadow-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
