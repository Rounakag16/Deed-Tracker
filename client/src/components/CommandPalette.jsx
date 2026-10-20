import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { deedLabel } from "../utils/deedLabel";

// Global search omnibar — toggles with Ctrl+K from anywhere in the app.
// Searches across deeds (scoped to the current workspace when one is open),
// debounces input to avoid hammering the API, and supports full keyboard
// navigation (arrow keys to move, Enter to select, Escape to close).
export default function CommandPalette({ workspace, onSelectDeed, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search — fires 250ms after the user stops typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(query.trim(), "all", workspace?._id, 1, 12);
        setResults(res.results || []);
        setActiveIndex(0);
      } catch {
        // silently ignore search errors in the palette
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, workspace?._id]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      onSelectDeed(results[activeIndex].deed);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-canvas/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border-strong rounded-2xl shadow-2xl overflow-hidden animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <svg
            className="w-5 h-5 text-ink-faint shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search deeds by number, name, mouja…"
            className="flex-1 bg-transparent text-ink placeholder:text-ink-faint py-4 text-sm focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-brass/30 border-t-brass rounded-full animate-spin shrink-0" />
          )}
          <kbd className="text-[10px] text-ink-faint bg-surface-raised border border-border rounded px-1.5 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {results.map(({ deed, parents, children }, i) => (
              <li
                key={deed._id}
                className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                  i === activeIndex
                    ? "bg-surface-raised border-l-2 border-verdigris"
                    : "border-l-2 border-transparent hover:bg-surface-raised/60"
                }`}
                onClick={() => {
                  onSelectDeed(deed);
                  onClose();
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-serif font-medium text-sm text-ink truncate pr-4">
                    {deedLabel(deed)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-ink-faint shrink-0">
                    {parents.length > 0 && (
                      <span title={`${parents.length} source deed(s)`}>↑{parents.length}</span>
                    )}
                    {children.length > 0 && (
                      <span title={`${children.length} derived deed(s)`}>↓{children.length}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-muted mt-1 overflow-hidden">
                  {deed.sellers?.[0]?.name && (
                    <span className="truncate">
                      <span className="text-ink-faint">From:</span> {deed.sellers[0].name}
                    </span>
                  )}
                  {deed.landParcels?.some((lp) => lp.mouja) && (
                    <span className="truncate">
                      <span className="text-ink-faint">Mouja:</span>{" "}
                      {deed.landParcels
                        .map((lp) => lp.mouja)
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-faint">
            No deeds found matching &ldquo;{query}&rdquo;
          </div>
        )}

        {!query.trim() && (
          <div className="px-4 py-4 flex items-center justify-between text-xs text-ink-faint">
            <span>Search across {workspace ? `"${workspace.name}"` : "all workspaces"}</span>
            <span className="flex items-center gap-3">
              <span>
                <kbd className="bg-surface-raised border border-border rounded px-1 py-0.5 text-[10px]">
                  ↑
                </kbd>
                <kbd className="bg-surface-raised border border-border rounded px-1 py-0.5 text-[10px] ml-0.5">
                  ↓
                </kbd>
                <span className="ml-1">navigate</span>
              </span>
              <span>
                <kbd className="bg-surface-raised border border-border rounded px-1 py-0.5 text-[10px]">
                  ↵
                </kbd>
                <span className="ml-1">select</span>
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
