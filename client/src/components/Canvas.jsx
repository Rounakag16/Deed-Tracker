import { useEffect, useState } from "react";
import { api } from "../api";
import DeedCard from "./DeedCard";
import { blankDeed } from "./DeedForm";

let tempIdCounter = 0;
const nextTempId = () => `draft_${++tempIdCounter}`;

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

export default function Canvas({ workspace }) {
  const [savedDeeds, setSavedDeeds] = useState([]);
  const [savedRelationships, setSavedRelationships] = useState([]);
  const [draftDeeds, setDraftDeeds] = useState([]); // { _tempId, ...deedFields }
  const [pendingEdges, setPendingEdges] = useState([]); // { sourceKey, targetKey, areaTransferred, note }
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirstPick, setConnectFirstPick] = useState(null);
  const [edgeDraft, setEdgeDraft] = useState(null); // { sourceKey, targetKey } awaiting area/note
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.listDeeds(workspace._id).then(setSavedDeeds);
    api.listRelationships(workspace._id).then(setSavedRelationships);
  };
  useEffect(load, [workspace._id]);

  // A "key" identifies any deed on screen, saved or draft, so edges can
  // reference either uniformly until save time.
  const keyFor = (deed) => (deed._id ? deed._id : deed._tempId);
  const allCards = [...savedDeeds.map((d) => ({ ...d })), ...draftDeeds];
  const labelForKey = (key) => {
    const d = allCards.find((c) => keyFor(c) === key);
    return d ? deedLabel(d) : key;
  };

  const addDraftDeed = () => {
    setDraftDeeds((prev) => [...prev, { _tempId: nextTempId(), ...blankDeed() }]);
  };

  const addFiveDraftDeeds = () => {
    setDraftDeeds((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, () => ({ _tempId: nextTempId(), ...blankDeed() })),
    ]);
  };

  const updateDraft = (tempId, next) => {
    setDraftDeeds((prev) => prev.map((d) => (d._tempId === tempId ? { ...next, _tempId: tempId } : d)));
  };

  const removeDraft = (tempId) => {
    setDraftDeeds((prev) => prev.filter((d) => d._tempId !== tempId));
    setPendingEdges((prev) =>
      prev.filter((e) => e.sourceKey !== tempId && e.targetKey !== tempId)
    );
  };

  const deleteSavedDeed = async (id) => {
    if (!confirm("Delete this deed and every relationship touching it?")) return;
    await api.deleteDeed(workspace._id, id);
    load();
  };

  const handleSelectForConnect = (deed) => {
    const key = keyFor(deed);
    if (!connectFirstPick) {
      setConnectFirstPick(key);
      return;
    }
    if (connectFirstPick === key) {
      setConnectFirstPick(null); // clicked same card again, deselect
      return;
    }
    setEdgeDraft({ sourceKey: connectFirstPick, targetKey: key, areaTransferred: "", note: "" });
    setConnectFirstPick(null);
  };

  const confirmEdgeDraft = () => {
    setPendingEdges((prev) => [...prev, edgeDraft]);
    setEdgeDraft(null);
  };

  const deleteSavedRelationship = async (id) => {
    await api.deleteRelationship(workspace._id, id);
    load();
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Persist new deeds, build tempId -> real _id map.
      const idMap = {};
      if (draftDeeds.length > 0) {
        const toCreate = draftDeeds.map(({ _tempId, ...fields }) => fields);
        const created = await api.createDeeds(workspace._id, toCreate);
        draftDeeds.forEach((d, i) => {
          idMap[d._tempId] = created[i]._id;
        });
      }
      // 2. Persist pending edges, resolving temp ids to real ids.
      if (pendingEdges.length > 0) {
        const resolved = pendingEdges.map((e) => ({
          sourceDeedId: idMap[e.sourceKey] || e.sourceKey,
          targetDeedId: idMap[e.targetKey] || e.targetKey,
          areaTransferred: e.areaTransferred,
          note: e.note,
        }));
        await api.createRelationships(workspace._id, resolved);
      }
      setDraftDeeds([]);
      setPendingEdges([]);
      setConnectMode(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasUnsaved = draftDeeds.length > 0 || pendingEdges.length > 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="text-xl font-bold">{workspace.name}</h2>
        <div className="flex-1" />
        <button onClick={addDraftDeed} className="bg-slate-900 text-white px-3 py-1.5 rounded text-sm">
          + Add Deed
        </button>
        <button
          onClick={addFiveDraftDeeds}
          className="border border-slate-900 px-3 py-1.5 rounded text-sm"
        >
          + Add 5 Deeds
        </button>
        <button
          onClick={() => {
            setConnectMode((v) => !v);
            setConnectFirstPick(null);
          }}
          className={`px-3 py-1.5 rounded text-sm ${
            connectMode ? "bg-blue-600 text-white" : "border border-blue-600 text-blue-600"
          }`}
        >
          {connectMode ? "Exit Connect Mode" : "Connect Deeds"}
        </button>
        <a
          href={api.exportWorkspaceUrl(workspace._id)}
          className="border border-green-700 text-green-700 px-3 py-1.5 rounded text-sm"
        >
          Export to Excel
        </a>
        {hasUnsaved && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm"
          >
            {saving ? "Saving…" : `Save (${draftDeeds.length} deed(s), ${pendingEdges.length} link(s))`}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {connectMode && (
        <p className="text-sm text-blue-700 mb-4">
          Click a source deed, then click the deed that derives from it. Repeat for as many
          links as you need, then confirm each below.
        </p>
      )}

      {/* Edge confirmation prompt */}
      {edgeDraft && (
        <div className="border border-blue-400 bg-blue-50 rounded p-3 mb-4 text-sm">
          <p className="mb-2">
            <strong>{labelForKey(edgeDraft.targetKey)}</strong> derives from{" "}
            <strong>{labelForKey(edgeDraft.sourceKey)}</strong>
          </p>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Area/share transferred (optional)"
              value={edgeDraft.areaTransferred}
              onChange={(e) => setEdgeDraft({ ...edgeDraft, areaTransferred: e.target.value })}
            />
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Note (optional)"
              value={edgeDraft.note}
              onChange={(e) => setEdgeDraft({ ...edgeDraft, note: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmEdgeDraft} className="bg-blue-600 text-white px-3 py-1 rounded">
              Add this link
            </button>
            <button onClick={() => setEdgeDraft(null)} className="px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending (unsaved) edges list */}
      {pendingEdges.length > 0 && (
        <div className="mb-4 text-sm">
          <p className="font-semibold mb-1">Pending links (not saved yet)</p>
          <ul className="space-y-1">
            {pendingEdges.map((e, i) => (
              <li key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <span>
                  {labelForKey(e.targetKey)} ← derives from ← {labelForKey(e.sourceKey)}
                  {e.areaTransferred ? ` (${e.areaTransferred})` : ""}
                </span>
                <button
                  className="text-red-600 text-xs ml-auto"
                  onClick={() => setPendingEdges((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deed cards */}
      <div className="flex flex-wrap gap-4 mb-8">
        {savedDeeds.map((deed) => (
          <DeedCard
            key={deed._id}
            deed={deed}
            isDraft={false}
            connectMode={connectMode}
            isSelectedForConnect={connectFirstPick === deed._id}
            onSave={async (next) => {
              const { _id, __v, createdAt, updatedAt, workspaceId, ...fields } = next;
              await api.updateDeed(workspace._id, deed._id, fields);
              load();
            }}
            onDelete={() => deleteSavedDeed(deed._id)}
            onSelectForConnect={handleSelectForConnect}
          />
        ))}
        {draftDeeds.map((deed) => (
          <DeedCard
            key={deed._tempId}
            deed={deed}
            isDraft
            connectMode={connectMode}
            isSelectedForConnect={connectFirstPick === deed._tempId}
            onChange={(next) => updateDraft(deed._tempId, next)}
            onDelete={() => removeDraft(deed._tempId)}
            onSelectForConnect={handleSelectForConnect}
          />
        ))}
      </div>

      {savedDeeds.length === 0 && draftDeeds.length === 0 && (
        <p className="text-slate-500">No deeds yet. Click "Add Deed" to start.</p>
      )}

      {/* Saved relationships list */}
      {savedRelationships.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Saved relationships</h3>
          <ul className="space-y-1 text-sm">
            {savedRelationships.map((rel) => {
              const source = savedDeeds.find((d) => d._id === rel.sourceDeedId);
              const target = savedDeeds.find((d) => d._id === rel.targetDeedId);
              return (
                <li
                  key={rel._id}
                  className="flex items-center gap-2 bg-white border rounded px-2 py-1"
                >
                  <span>
                    {target ? deedLabel(target) : "(deleted)"} ← derives from ←{" "}
                    {source ? deedLabel(source) : "(deleted)"}
                    {rel.areaTransferred ? ` (${rel.areaTransferred})` : ""}
                  </span>
                  <button
                    className="text-red-600 text-xs ml-auto"
                    onClick={() => deleteSavedRelationship(rel._id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
