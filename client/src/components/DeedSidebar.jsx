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
export default function DeedSidebar({ deed, isDraft, onChange, onSave, onDelete, onDerive, onPrint, onClose, onDirtyChange }) {
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
    <div className="w-[450px] shrink-0 border-l border-border bg-surface flex flex-col text-ink shadow-2xl z-20 relative animate-slide-in-right">
      <div className="flex items-start justify-between p-5 border-b border-border shrink-0 bg-surface-raised">
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
              className="bg-verdigris hover:bg-verdigris/90 text-canvas font-medium text-sm px-4 py-2 rounded-lg disabled:opacity-60 transition-all active:scale-95 shadow-sm"
              onClick={handleSaveClick}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="text-sm px-4 py-2 border border-border text-ink-muted hover:text-ink rounded-lg transition-colors active:scale-95"
              onClick={handleDiscardClick}
            >
              Discard
            </button>
          </>
        )}
        <div className="flex-1" />
        <button 
          type="button" 
          className="text-verdigris border border-verdigris/30 hover:bg-verdigris/10 text-sm px-4 py-2 rounded-lg transition-colors active:scale-95" 
          onClick={onDerive}
          title="Create a new child deed pre-filled with this deed's parcels and linked to it"
        >
          Derive Child
        </button>
        {onPrint && (
          <button
            type="button"
            className="text-ink-muted border border-border hover:bg-surface-raised text-sm px-3 py-2 rounded-lg transition-colors active:scale-95 ml-1"
            onClick={onPrint}
            title="Print this deed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
        )}
        <button type="button" className="text-brick text-sm hover:underline ml-1 transition-colors active:scale-95 px-2" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
