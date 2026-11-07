import { useState, useEffect } from "react";
import { api } from "./api";
import WorkspaceList from "./components/WorkspaceList";
import Canvas from "./components/Canvas";
import SearchWorkspace from "./components/SearchWorkspace";
import LineageGraph from "./components/LineageGraph";
import DeedTableView from "./components/DeedTableView";
import CommandPalette from "./components/CommandPalette";

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("canvas"); // "canvas" | "search" | "lineage" | "table"
  const [selectedDeedId, setSelectedDeedId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleSelectSearchResult = async (deed) => {
    if (workspace && String(deed.workspaceId) === String(workspace._id)) {
      setSelectedDeedId(deed._id);
      setTab("lineage");
      return;
    }
    // Result belongs to a different workspace than the one currently open -
    // switch to it first.
    const ws = await api.getWorkspace(deed.workspaceId);
    setWorkspace(ws);
    setSelectedDeedId(deed._id);
    setTab("lineage");
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!workspace) {
    return <WorkspaceList onOpen={setWorkspace} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-surface border-b border-border shrink-0">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-4">
          <button
            onClick={() => setWorkspace(null)}
            className="text-sm text-ink-faint hover:text-ink-muted py-3"
          >
            ← All workspaces
          </button>
          <button
            onClick={() => setTab("canvas")}
            className={`py-3 border-b-2 text-sm px-2 ${
              tab === "canvas" ? "border-brass font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Workspace
          </button>
          <button
            onClick={() => setTab("search")}
            className={`py-3 border-b-2 text-sm px-2 ${
              tab === "search" ? "border-brass font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setTab("table")}
            className={`py-3 border-b-2 text-sm px-2 flex items-center gap-1.5 ${
              tab === "table" ? "border-brass font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
            Table
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 text-sm text-ink-faint hover:text-ink-muted transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-raised"
            title="Search deeds (Ctrl+K)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <kbd className="text-[10px] bg-surface-raised border border-border rounded px-1.5 py-0.5">Ctrl+K</kbd>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "canvas" ? (
          <Canvas workspace={workspace} onView={() => setTab("lineage")} />
        ) : tab === "search" ? (
          <SearchWorkspace workspace={workspace} />
        ) : tab === "table" ? (
          <DeedTableView
            workspace={workspace}
            onSelectDeed={handleSelectSearchResult}
          />
        ) : (
          <LineageGraph
            workspace={workspace}
            onBack={() => setTab("canvas")}
            initialSelectedId={selectedDeedId}
          />
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          workspace={workspace}
          onSelectDeed={(deed) => { handleSelectSearchResult(deed); setPaletteOpen(false); }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
