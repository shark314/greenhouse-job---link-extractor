import React, { useState } from "react";
import { Terminal, ExternalLink, Sparkles, Layers, BookOpen, Download, Check } from "lucide-react";
import { downloadExtensionZip } from "../utils/extensionZip";

interface HeaderProps {
  onOpenExtensionModal: () => void;
  onOpenScriptsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExtensionModal, onOpenScriptsModal }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadExtensionZip();
      setTimeout(() => setDownloading(false), 2000);
    } catch (err) {
      console.error("Zip download failed", err);
      setDownloading(false);
    }
  };

  return (
    <header className="h-16 px-4 sm:px-8 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-base shadow-sm">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-gray-900">
              Greenhouse Auto-Extractor Extension
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-mono uppercase tracking-wider font-semibold">
              Non-Sidebar V3
            </span>
          </div>
          <p className="text-xs text-gray-500 hidden md:block">
            Auto-extracts job description & embedded links on page open without using sidebar
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        <button
          id="open-scripts-btn"
          onClick={onOpenScriptsModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition"
        >
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Scripts</span>
        </button>

        <button
          id="open-extension-btn"
          onClick={onOpenExtensionModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Inspect Source</span>
        </button>

        <button
          id="direct-download-ext-btn"
          onClick={handleDownloadZip}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition active:scale-98"
        >
          {downloading ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span>{downloading ? "Downloaded!" : "Download Extension (.ZIP)"}</span>
        </button>
      </div>
    </header>
  );
};
