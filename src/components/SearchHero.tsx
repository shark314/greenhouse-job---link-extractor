import React, { useState } from "react";
import { Search, Globe, ArrowRight, CornerDownRight, History, Sparkles, RefreshCw, AlertCircle, Terminal } from "lucide-react";

interface SearchHeroProps {
  onSearch: (input: string) => void;
  isLoading: boolean;
  currentInput: string;
}

export const SearchHero: React.FC<SearchHeroProps> = ({ onSearch, isLoading, currentInput }) => {
  const [inputValue, setInputValue] = useState(currentInput || "https://job-boards.greenhouse.io/synack/jobs/8023991");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue.trim());
    }
  };

  const handlePreset = (preset: string) => {
    setInputValue(preset);
    onSearch(preset);
  };

  return (
    <div className="bg-white border-b border-gray-200 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Direct JSON API Retrieval • Wayback Archive Fallback • Link Extractor</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-semibold text-gray-900 tracking-tight">
          Greenhouse API & Job Description Inspector
        </h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Inspect any Greenhouse job URL, company board token, or numeric job ID. We query the official <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-xs border border-blue-100">boards-api.greenhouse.io</code>, search the <span className="text-amber-700 font-medium">Wayback Machine archive</span> for unlisted/removed roles, and extract embedded links.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="pt-2 max-w-2xl mx-auto">
          <div className="relative flex items-center bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white rounded-xl p-1.5 shadow-sm transition group">
            <div className="pl-3 pr-2 text-gray-400 group-focus-within:text-blue-600 transition">
              <Globe className="w-5 h-5" />
            </div>
            <input
              id="job-url-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. https://job-boards.greenhouse.io/synack/jobs/8023991 or synack 8023991"
              className="w-full bg-transparent border-none text-gray-900 placeholder-gray-400 text-sm sm:text-base focus:outline-none px-2 py-1.5"
            />
            <button
              id="submit-fetch-btn"
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-medium text-sm transition shrink-0 shadow-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <span>Extract Job</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Presets & Quick Tests */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
          <span className="text-gray-500 flex items-center gap-1 font-medium">
            <CornerDownRight className="w-3.5 h-3.5 text-gray-400" />
            Quick Presets:
          </span>

          <button
            onClick={() => handlePreset("https://job-boards.greenhouse.io/synack/jobs/8023991")}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-mono transition shadow-xs"
            title="Synack Job 8023991 (Expired -> Auto Wayback Recovery)"
          >
            🎯 Synack #8023991 (Your Link)
          </button>

          <button
            onClick={() => handlePreset("synack")}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-mono transition shadow-xs"
            title="Synack Company Board All Jobs"
          >
            🏢 Synack Board Feed
          </button>

          <button
            onClick={() => handlePreset("https://boards.greenhouse.io/stripe/jobs/5647890")}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-mono transition shadow-xs"
            title="Stripe Board Test"
          >
            💳 Stripe Sample
          </button>

          <button
            onClick={() => handlePreset("airbnb")}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-mono transition shadow-xs"
            title="Airbnb Board Test"
          >
            🏡 Airbnb Feed
          </button>
        </div>
      </div>
    </div>
  );
};
