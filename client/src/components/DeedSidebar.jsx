import { useEffect, useState } from "react";
import DeedForm from "./DeedForm";

// Full deed detail/edit panel, shown alongside the canvas when a card is
// selected. This owns the same local-edit-buffering pattern DeedCard.jsx
// used to own before inline expand was removed: for a saved (non-draft)
// deed, edits are kept in local state and only PUT to the server on an
// explicit "Save changes" click, so typing doesn't trigger a PUT + reload
// on every keystroke (see PROJECT_CONTEXT.md's Important Implementation
// Details - this buffering is load-bearing, don't simplify it away). For
// a draft (unsaved) deed, edits fire onChange immediately - cheap, since
// they're only held in memory until the batch "Save" on the canvas.
export default function DeedSidebar({ deed, isDraft, onChange, onSave, onDelete, onClose, onDirtyChange }) {
  const [localDeed, setLocalDeed] = useState(deed);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) setLocalDeed(deed);
  }, [deed, dirty]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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
    setSaving(true);
    try {
      await onSave(localDeed);
      setDirty(false);
    } finally {
      setSaving(false);
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
    <div className="w-96 shrink-0 border-l border-border bg-surface flex flex-col text-ink">
      <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
        <div className="min-w-0">
          <p className="font-semibold font-serif truncate">
            {summary} {isDraft && <span className="text-brass text-xs font-sans font-normal">(unsaved)</span>}
          </p>
          {buyer && <p className="text-xs text-ink-muted truncate mt-0.5">Buyer: {buyer}</p>}
          {!isDraft && dirty && <p className="text-xs text-brass mt-0.5">Unsaved changes</p>}
        </div>
        <button
          onClick={onClose}
          className="text-ink-faint hover:text-ink text-sm shrink-0 ml-2"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <DeedForm deed={displayDeed} onChange={handleFormChange} />
      </div>

      <div className="flex items-center gap-2 p-4 border-t border-border shrink-0">
        {!isDraft && dirty && (
          <>
            <button
              type="button"
              className="bg-verdigris text-canvas font-medium text-sm px-3 py-1.5 rounded disabled:opacity-60"
              onClick={handleSaveClick}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="text-sm px-3 py-1.5 border border-border text-ink-muted hover:text-ink rounded"
              onClick={handleDiscardClick}
            >
              Discard
            </button>
          </>
        )}
        <div className="flex-1" />
        <button type="button" className="text-brick text-sm hover:underline" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
