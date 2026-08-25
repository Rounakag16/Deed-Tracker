import { useEffect, useState } from "react";
import DeedForm from "./DeedForm";

export default function DeedCard({
  deed,
  isDraft,
  isSelectedForConnect,
  connectMode,
  onChange, // used for drafts: fires on every keystroke, kept in memory only (cheap)
  onSave, // used for saved deeds: only called when the user clicks Save
  onDelete,
  onSelectForConnect,
}) {
  const [expanded, setExpanded] = useState(isDraft);

  // Saved deeds buffer edits locally so typing doesn't PUT + reload on
  // every keystroke. Only synced back to `deed` prop when not dirty, so a
  // background reload doesn't clobber in-progress edits.
  const [localDeed, setLocalDeed] = useState(deed);
  const [dirty, setDirty] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);

  useEffect(() => {
    if (!dirty) setLocalDeed(deed);
  }, [deed, dirty]);

  const displayDeed = isDraft ? deed : localDeed;

  const handleFormChange = (next) => {
    if (isDraft) {
      onChange(next);
    } else {
      setLocalDeed(next);
      setDirty(true);
    }
  };

  const handleSaveClick = async () => {
    setSavingLocal(true);
    try {
      await onSave(localDeed);
      setDirty(false);
    } finally {
      setSavingLocal(false);
    }
  };

  const handleDiscardClick = () => {
    setLocalDeed(deed);
    setDirty(false);
  };

  const summary =
    displayDeed.deedInfo?.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const buyer = displayDeed.purchasers?.[0]?.name;

  return (
    <div
      className={`w-80 border rounded-lg bg-white shadow-sm p-3 ${
        isSelectedForConnect ? "ring-2 ring-blue-500" : ""
      } ${connectMode ? "cursor-pointer" : ""}`}
      onClick={connectMode ? () => onSelectForConnect(deed) : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">
            {summary} {isDraft && <span className="text-amber-600 text-xs">(unsaved)</span>}
          </p>
          {buyer && <p className="text-xs text-slate-500">Buyer: {buyer}</p>}
        </div>
        {!connectMode && (
          <div className="flex gap-2">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Collapse" : "Edit"}
            </button>
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && !connectMode && (
        <div className="mt-3 border-t pt-3">
          <DeedForm deed={displayDeed} onChange={handleFormChange} />
          {!isDraft && dirty && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="bg-green-600 text-white text-xs px-3 py-1 rounded"
                onClick={handleSaveClick}
                disabled={savingLocal}
              >
                {savingLocal ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1 border rounded"
                onClick={handleDiscardClick}
              >
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
