import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import FullDeedRecord from "./FullDeedRecord";
import { printAllDeedRecords } from "../utils/print";

const TOPICS = [
  { value: "all",             label: "All Fields" },
  { value: "deedNo",          label: "Deed No." },
  { value: "volumeNo",        label: "Volume No." },
  { value: "pageNo",          label: "Page No." },
  { value: "officeNo",        label: "Office No. (Sub-Registry)" },
  { value: "purchaser",       label: "Purchaser (Name or Father)" },
  { value: "purchaserName",   label: "Purchaser Name" },
  { value: "purchaserFather", label: "Purchaser Father's Name" },
  { value: "seller",          label: "Seller (Name or Father)" },
  { value: "sellerName",      label: "Seller Name" },
  { value: "sellerFather",    label: "Seller Father's Name" },
  { value: "mouja",           label: "Mouja" },
  { value: "sheetNo",         label: "Sheet No." },
  { value: "khatiyaNo",       label: "Khatiya No." },
  { value: "plotNoRS",        label: "Plot No. (RS)" },
  { value: "plotNoLR",        label: "Plot No. (LR)" },
  { value: "area",            label: "Area" },
  { value: "title",           label: "Title / Reference" },
];

const PAGE_SIZE = 20;

export default function SearchPanel({ workspace, onlyThisWorkspace = true, onSelectDeed }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [exact, setExact] = useState(false);
  const [scopeWorkspace, setScopeWorkspace] = useState(onlyThisWorkspace);
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // Debounced search-as-you-type
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      setTotal(0);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(null, 1), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, topic, exact, scopeWorkspace]);

  const runSearch = async (e, targetPage = 1) => {
    if (e) e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.search(
        q.trim(),
        topic,
        scopeWorkspace ? workspace?._id : undefined,
        targetPage,
        PAGE_SIZE,
        exact
      );
      setResults(res.results);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentTopicLabel = TOPICS.find((t) => t.value === topic)?.label || topic;

  const handlePrintAll = () => {
    if (!results || results.length === 0) return;
    printAllDeedRecords(results, q.trim(), currentTopicLabel, scopeWorkspace ? workspace?.name : null);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 text-ink space-y-6">
      {/* Search Header Banner */}
      <div className="bg-surface border border-border-strong rounded-2xl p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-xl font-serif font-bold text-ink flex items-center gap-2">
            <span>Deed Search &amp; Print View</span>
            {scopeWorkspace && workspace?.name && (
              <span className="text-xs font-sans font-normal text-brass px-2 py-0.5 rounded bg-brass/10 border border-brass/25">
                {workspace.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Search deeds by specific field names and values. Results are presented as complete, full-information deed records ready for direct review and printing.
          </p>
        </div>

        {/* Search Controls Form */}
        <form onSubmit={(e) => runSearch(e, 1)} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Target Field Select */}
            <div className="sm:w-56 shrink-0">
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full border border-border-strong bg-canvas text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-colors cursor-pointer"
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Query Input */}
            <div className="relative flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${currentTopicLabel}…`}
                className="w-full border border-border-strong bg-canvas text-ink placeholder:text-ink-faint rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-colors"
                autoFocus
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink text-xs p-1"
                  title="Clear search query"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Submit Button */}
            <button
              type="submit"
              disabled={!q.trim() || loading}
              className="bg-brass hover:bg-brass-soft text-canvas font-medium text-sm px-6 py-2.5 rounded-xl disabled:opacity-40 transition-all active:scale-95 shadow-sm"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Filters & Options Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-ink-muted">
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-ink">
                <input
                  type="checkbox"
                  checked={exact}
                  onChange={(e) => setExact(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border-strong text-brass focus:ring-brass accent-brass"
                />
                <span>Exact match only</span>
              </label>

              {workspace && (
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-ink">
                  <input
                    type="checkbox"
                    checked={scopeWorkspace}
                    onChange={(e) => setScopeWorkspace(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border-strong text-brass focus:ring-brass accent-brass"
                  />
                  <span>This workspace only ({workspace.name})</span>
                </label>
              )}
            </div>

            {/* Print All Button */}
            {results && results.length > 0 && (
              <button
                type="button"
                onClick={handlePrintAll}
                className="flex items-center gap-1.5 border border-border-strong text-ink hover:text-brass hover:border-brass bg-surface-raised px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 shadow-sm"
                title="Print all matching full deed records with page breaks"
              >
                <svg className="w-3.5 h-3.5 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print All {total} Result(s)</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results Header / Summary */}
      {results && (
        <div className="flex items-center justify-between text-xs text-ink-muted px-1">
          <div>
            Showing <strong className="text-ink">{results.length}</strong> of{" "}
            <strong className="text-ink">{total}</strong> complete deed record{total === 1 ? "" : "s"} for{" "}
            <span className="text-brass font-medium">"{q}"</span> in{" "}
            <span className="text-ink font-medium">{currentTopicLabel}</span>
            {exact && <span className="ml-1 text-ink-faint">(exact match)</span>}
          </div>
          {totalPages > 1 && (
            <div className="text-ink-faint">
              Page {page} of {totalPages}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-ink-muted space-y-2">
          <div className="inline-block w-6 h-6 border-2 border-brass border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm">Fetching complete deed records…</p>
        </div>
      )}

      {/* Empty states */}
      {!loading && results && results.length === 0 && (
        <div className="bg-surface border border-border-strong rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-surface-raised rounded-xl flex items-center justify-center mx-auto text-ink-faint">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-serif font-semibold text-ink text-base">No Matching Deeds Found</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            No deed records in this {scopeWorkspace ? "workspace" : "database"} matched your search for{" "}
            <strong className="text-ink">"{q}"</strong> under{" "}
            <strong className="text-ink">{currentTopicLabel}</strong>.
            {exact && " Try unchecking 'Exact match only' to allow partial matches."}
          </p>
        </div>
      )}

      {/* Full Deed Records List */}
      {!loading && results && results.length > 0 && (
        <div className="space-y-6">
          {results.map(({ deed, parents, children }) => (
            <FullDeedRecord
              key={deed._id}
              deed={deed}
              parents={parents}
              children={children}
              searchQuery={q}
              searchTopic={topic}
              onSelectDeed={onSelectDeed}
            />
          ))}
        </div>
      )}

      {/* Initial Guidance when no search has been entered */}
      {!results && !loading && (
        <div className="border border-border/60 bg-surface/40 rounded-2xl p-10 text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 bg-surface-raised rounded-xl flex items-center justify-center mx-auto text-brass">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-serif font-semibold text-ink text-base">Full Deed Record Search</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Select any specific field (such as Deed Number, Purchaser, Seller, Mouja, or Plot Number) and enter a search value. Matching deeds will appear with their full registration data, party lists, land parcel plots, and lineage relationships.
          </p>
        </div>
      )}

      {/* Pagination Controls */}
      {results && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border text-sm">
          <button
            onClick={() => runSearch(null, page - 1)}
            disabled={page <= 1 || loading}
            className="px-4 py-2 border border-border text-ink-muted hover:text-ink rounded-lg disabled:opacity-40 transition-colors bg-surface"
          >
            ← Previous Page
          </button>
          <span className="text-xs text-ink-faint">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => runSearch(null, page + 1)}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 border border-border text-ink-muted hover:text-ink rounded-lg disabled:opacity-40 transition-colors bg-surface"
          >
            Next Page →
          </button>
        </div>
      )}
    </div>
  );
}
