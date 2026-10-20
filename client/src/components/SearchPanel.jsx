import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { deedLabel } from "../utils/deedLabel";
import { printSearchResults } from "../utils/print";

const TOPICS = [
  { value: "all", label: "All fields" },
  { value: "purchaser", label: "Purchaser" },
  { value: "seller", label: "Seller" },
  { value: "deedNo", label: "Deed No." },
  { value: "volumeNo", label: "Volume No." },
  { value: "pageNo", label: "Page No." },
  { value: "officeNo", label: "Office No." },
  { value: "mouja", label: "Mouja" },
  { value: "sheetNo", label: "Sheet No." },
  { value: "khatiyaNo", label: "Khatiya No." },
  { value: "plotNoRS", label: "Plot No. (RS)" },
  { value: "plotNoLR", label: "Plot No. (LR)" },
];

// deedLabel is now imported from ../utils/deedLabel

const PAGE_SIZE = 25;

export default function SearchPanel({ workspace, onlyThisWorkspace = true, onSelectDeed }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [scopeWorkspace, setScopeWorkspace] = useState(onlyThisWorkspace);
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // Debounced search-as-you-type
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(null, 1), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, topic, scopeWorkspace]);

  const runSearch = async (e, targetPage = 1) => {
    if (e) e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.search(
        q.trim(),
        topic,
        scopeWorkspace ? workspace._id : undefined,
        targetPage,
        PAGE_SIZE
      );
      setResults(res.results);
      setTotal(res.total);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 text-ink">
      <form onSubmit={runSearch} className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="flex-1 border border-border-strong bg-surface text-ink placeholder:text-ink-faint rounded px-3 py-2 focus:outline-none focus:border-brass"
        />
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="border border-border-strong bg-surface text-ink rounded px-2 py-2 focus:outline-none focus:border-brass"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={scopeWorkspace}
            onChange={(e) => setScopeWorkspace(e.target.checked)}
          />
          This workspace only
        </label>
        <button type="submit" className="bg-brass text-canvas font-medium px-4 py-2 rounded">Search</button>
        {results && results.length > 0 && (
          <button
            type="button"
            onClick={() => printSearchResults(results, q, scopeWorkspace ? workspace?.name : null)}
            className="border border-border text-ink-muted px-3 py-2 rounded text-sm hover:text-ink hover:bg-surface-raised transition-colors"
            title="Print search results"
          >
            <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        )}
      </form>

      {loading && <p className="text-ink-muted">Searching…</p>}
      {results && results.length === 0 && <p className="text-ink-faint">No matches.</p>}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map(({ deed, parents, children }) => (
            <li
              key={deed._id}
              className="bg-surface border border-border rounded p-3 cursor-pointer hover:border-brass"
              onClick={() => onSelectDeed && onSelectDeed(deed)}
            >
              <p className="font-medium font-serif text-brass hover:underline">{deedLabel(deed)}</p>
              <p className="text-xs text-ink-faint">
                Mouja: {deed.landParcels?.map((lp) => lp.mouja).filter(Boolean).join(", ") || "—"}
              </p>
              {parents.length > 0 && (
                <p className="text-xs text-ink-faint">{parents.length} parent deed(s)</p>
              )}
              {children.length > 0 && (
                <p className="text-xs text-ink-faint">{children.length} child deed(s)</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {results && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => runSearch(null, page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1 border border-border text-ink-muted rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-ink-faint">
            Page {page} of {totalPages} ({total} match{total === 1 ? "" : "es"})
          </span>
          <button
            onClick={() => runSearch(null, page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1 border border-border text-ink-muted rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
