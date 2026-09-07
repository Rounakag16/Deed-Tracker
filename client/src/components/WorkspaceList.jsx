import { useEffect, useState } from "react";
import { api } from "../api";

const PAGE_SIZE = 20;

export default function WorkspaceList({ onOpen }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const load = () => {
    setLoading(true);
    api
      .listWorkspaces(page, PAGE_SIZE)
      .then((res) => {
        setWorkspaces(res.workspaces);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createWorkspace(name.trim());
      setName("");
      // Newest-first sort means a new workspace always lands on page 1.
      if (page !== 1) setPage(1);
      else load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this workspace and every deed/relationship in it?")) return;
    await api.deleteWorkspace(id);
    // If that was the last workspace on this page (and not page 1), step back
    // a page instead of showing an empty page.
    if (workspaces.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const startRename = (w) => {
    setRenamingId(w._id);
    setRenameValue(w.name);
  };

  const submitRename = async (id) => {
    if (!renameValue.trim()) return;
    try {
      await api.updateWorkspace(id, { name: renameValue.trim() });
      setRenamingId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold font-serif mb-6">DeedTracker — Workspaces</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name (e.g. '100-acre Sundarban tract')"
          className="flex-1 border border-border-strong bg-surface text-ink placeholder:text-ink-faint rounded px-3 py-2 focus:outline-none focus:border-brass"
        />
        <button className="bg-brass text-canvas font-medium px-4 py-2 rounded hover:bg-brass-soft">
          Create
        </button>
      </form>

      {error && <p className="text-brick mb-4">{error}</p>}
      {loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : workspaces.length === 0 ? (
        <p className="text-ink-faint">No workspaces yet — create one above.</p>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((w) => (
            <li
              key={w._id}
              className="flex items-center justify-between bg-surface border border-border rounded px-4 py-3"
            >
              {renamingId === w._id ? (
                <form
                  className="flex gap-2 flex-1 mr-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitRename(w._id);
                  }}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 border border-border-strong bg-canvas text-ink rounded px-2 py-1 focus:outline-none focus:border-brass"
                  />
                  <button className="text-sm text-verdigris hover:underline">Save</button>
                  <button
                    type="button"
                    className="text-sm text-ink-muted hover:underline"
                    onClick={() => setRenamingId(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => onOpen(w)}
                  className="text-left font-medium font-serif hover:underline"
                >
                  {w.name}
                </button>
              )}
              {renamingId !== w._id && (
                <div className="flex gap-3">
                  <button
                    onClick={() => startRename(w)}
                    className="text-ink-muted text-sm hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(w._id)}
                    className="text-brick text-sm hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 border border-border text-ink-muted rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-ink-faint">
            Page {page} of {totalPages} ({total} workspace{total === 1 ? "" : "s"})
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 border border-border text-ink-muted rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
