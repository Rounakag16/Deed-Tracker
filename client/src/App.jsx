import { useState } from "react";
import { api } from "./api";
import WorkspaceList from "./components/WorkspaceList";
import Canvas from "./components/Canvas";
import SearchPanel from "./components/SearchPanel";
import LineageGraph from "./components/LineageGraph";

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("canvas"); // "canvas" | "search" | "lineage"
  const [selectedDeedId, setSelectedDeedId] = useState(null);

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

  if (!workspace) {
    return <WorkspaceList onOpen={setWorkspace} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b shrink-0">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-4">
          <button
            onClick={() => setWorkspace(null)}
            className="text-sm text-slate-500 hover:underline py-3"
          >
            ← All workspaces
          </button>
          <button
            onClick={() => setTab("canvas")}
            className={`py-3 border-b-2 text-sm px-2 ${
              tab === "canvas" ? "border-slate-900 font-medium" : "border-transparent text-slate-500"
            }`}
          >
            Workspace
          </button>
          <button
            onClick={() => setTab("search")}
            className={`py-3 border-b-2 text-sm px-2 ${
              tab === "search" ? "border-slate-900 font-medium" : "border-transparent text-slate-500"
            }`}
          >
            Search
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
    </div>
  );
}
