import { useEffect, useState } from "react";
import { api } from "../api";

export default function WorkspaceList({ onOpen }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .listWorkspaces()
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createWorkspace(name.trim());
      setName("");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this workspace and every deed/relationship in it?")) return;
    await api.deleteWorkspace(id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">DeedTracker — Workspaces</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name (e.g. '100-acre Sundarban tract')"
          className="flex-1 border rounded px-3 py-2"
        />
        <button className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700">
          Create
        </button>
      </form>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : workspaces.length === 0 ? (
        <p className="text-slate-500">No workspaces yet — create one above.</p>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((w) => (
            <li
              key={w._id}
              className="flex items-center justify-between bg-white border rounded px-4 py-3"
            >
              <button
                onClick={() => onOpen(w)}
                className="text-left font-medium hover:underline"
              >
                {w.name}
              </button>
              <button
                onClick={() => handleDelete(w._id)}
                className="text-red-600 text-sm hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
