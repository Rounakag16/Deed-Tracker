import { useState } from "react";
import WorkspaceList from "./components/WorkspaceList";
import Canvas from "./components/Canvas";
import SearchPanel from "./components/SearchPanel";
import LineageGraph from "./components/LineageGraph";

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState("canvas"); // "canvas" | "search"

  if (!workspace) {
    return <WorkspaceList onOpen={setWorkspace} />;
  }

  return (
    <div>
      <div className="bg-white border-b sticky top-0 z-10">
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
          <button
            onClick={() => setTab("lineage")}
            className={`py-3 border-b-2 text-sm px-2 ${
              tab === "lineage" ? "border-slate-900 font-medium" : "border-transparent text-slate-500"
            }`}
          >
            Lineage
          </button>
        </div>
      </div>

      {tab === "canvas" ? (
        <Canvas workspace={workspace} />
      ) : tab === "search" ? (
        <SearchPanel workspace={workspace} />
      ) : (
        <LineageGraph workspace={workspace} />
      )}
    </div>
  );
}
