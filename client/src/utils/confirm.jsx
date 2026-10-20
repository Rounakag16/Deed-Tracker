import React from 'react';
import { createRoot } from 'react-dom/client';

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/60 backdrop-blur-sm p-4">
      <div 
        className="bg-surface border border-border-strong rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-zoom-in"
      >
        <h3 className="text-lg font-serif font-semibold text-ink mb-2">Are you sure?</h3>
        <p className="text-ink-muted text-sm mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm text-ink-muted hover:text-ink border border-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-verdigris hover:bg-verdigris/90 text-canvas font-medium rounded-lg transition-colors shadow-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function customConfirm(message) {
  return new Promise((resolve) => {
    // Create a temporary container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create a React root
    const root = createRoot(container);
    
    const cleanup = () => {
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 0);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    root.render(
      <ConfirmModal 
        message={message} 
        onConfirm={handleConfirm} 
        onCancel={handleCancel} 
      />
    );
  });
}
