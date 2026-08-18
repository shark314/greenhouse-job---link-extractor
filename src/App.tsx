/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { SearchHero } from "./components/SearchHero";
import { JobResultView } from "./components/JobResultView";
import { LinkIntelligenceAi } from "./components/LinkIntelligenceAi";
import { ScriptsPanel } from "./components/ScriptsPanel";
import { ExtensionBuilderModal } from "./components/ExtensionBuilderModal";
import { FetchResult } from "./types";
import { Terminal, Shield, Sparkles, Layers, BookOpen, AlertCircle, RefreshCw } from "lucide-react";

export default function App() {
  const [currentInput, setCurrentInput] = useState<string>("https://job-boards.greenhouse.io/synack/jobs/8023991");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<"result" | "scripts" | "ai">("result");

  const executeFetch = async (inputStr: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentInput(inputStr);

    try {
      const response = await fetch("/api/greenhouse/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrInput: inputStr }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data: FetchResult = await response.json();
      setResult(data);
      setActiveSection("result");
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to inspect Greenhouse job.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial extraction for the user's specific Synack query on mount
  useEffect(() => {
    executeFetch(currentInput);
  }, []);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <Header
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        onOpenScriptsModal={() => {
          setActiveSection("scripts");
          const el = document.getElementById("scripts-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <main className="flex-1 pb-16">
        {/* Search Hero */}
        <SearchHero
          currentInput={currentInput}
          isLoading={isLoading}
          onSearch={(input) => executeFetch(input)}
        />

        {/* Global Error Notice */}
        {error && (
          <div className="max-w-5xl mx-auto px-4 mt-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm shadow-xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="flex-1">{error}</p>
              <button
                onClick={() => executeFetch(currentInput)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition shadow-xs"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !result && (
          <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">Querying Greenhouse API & Wayback Archives...</h3>
              <p className="text-xs text-gray-500">
                Checking <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded">boards-api.greenhouse.io</code>, inspecting active jobs list, and querying Internet Archive CDX...
              </p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {result && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
            {/* View Section Tabs */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  id="tab-inspector"
                  onClick={() => setActiveSection("result")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
                    activeSection === "result"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Job & Extracted Links ({result.links.length})</span>
                </button>

                <button
                  id="tab-scripts"
                  onClick={() => setActiveSection("scripts")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
                    activeSection === "scripts"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Automated Scripts (Python/Node/CLI)</span>
                </button>

                <button
                  id="tab-ai"
                  onClick={() => setActiveSection("ai")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
                    activeSection === "ai"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>AI Outreach & Link Intelligence</span>
                </button>
              </div>

              <span className="text-xs font-mono text-gray-500 hidden md:block">
                Board: <strong className="text-gray-800">{result.board}</strong> | ID: <strong className="text-gray-800">{result.jobId || "N/A"}</strong>
              </span>
            </div>

            {/* Tab 1: Job Result & Extracted Links */}
            {activeSection === "result" && (
              <div className="space-y-6">
                <JobResultView result={result} />
                
                {/* AI Assistant Quick Callout */}
                <LinkIntelligenceAi
                  jobTitle={result.job?.title}
                  board={result.board}
                  plainText={result.plainText}
                  links={result.links}
                />
              </div>
            )}

            {/* Tab 2: Scripts Generator */}
            {activeSection === "scripts" && (
              <div id="scripts-section" className="space-y-6">
                <ScriptsPanel board={result.board} jobId={result.jobId} />
              </div>
            )}

            {/* Tab 3: AI Intelligence Assistant */}
            {activeSection === "ai" && (
              <div className="space-y-6">
                <LinkIntelligenceAi
                  jobTitle={result.job?.title}
                  board={result.board}
                  plainText={result.plainText}
                  links={result.links}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Non-Sidebar Chrome Extension Modal */}
      <ExtensionBuilderModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>Greenhouse Job Description & Embedded Link Extractor</p>
          <div className="flex items-center gap-4 text-gray-500">
            <span>Powered by official Greenhouse JSON API & Wayback Machine CDX</span>
            <button
              onClick={() => setIsExtensionModalOpen(true)}
              className="text-blue-600 hover:underline font-medium"
            >
              Get Extension (No Sidebar)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
