import { useState, useEffect } from "react";
import { api } from "./api";
import WorkspaceList from "./components/WorkspaceList";
import Canvas from "./components/Canvas";
import SearchPanel from "./components/SearchPanel";
import LineageGraph from "./components/LineageGraph";
import CommandPalette from "./components/CommandPalette";

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("canvas"); // "canvas" | "search" | "lineage"
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
          <SearchPanel workspace={workspace} onSelectDeed={handleSelectSearchResult} />
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
