/**
 * Dialog to confirm key deletion.
 * Displays only the label and masked preview, never the key value.
 */

'use client';

import { useEffect, useRef } from 'react';

export interface DeleteApiKeyTarget {
  id: string;
  label: string;
  keyPreview: string;
}

interface DeleteApiKeyDialogProps {
  target: DeleteApiKeyTarget | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteApiKeyDialog({ target, onConfirm, onCancel }: DeleteApiKeyDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!target) {
      return;
    }
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [target, onCancel]);

  if (!target) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-api-key-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
      >
        <h2 id="delete-api-key-dialog-title" className="text-base font-bold text-foreground">
          حذف المفتاح
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          سيُحذف المفتاح «{target.label}» (<span dir="ltr">{target.keyPreview}</span>) نهائيًا من
          هذا المتصفح. إذا كان المفتاح الافتراضي فسيُختار بديل مناسب تلقائيًا إن وُجد.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            حذف المفتاح
          </button>
        </div>
      </div>
    </div>
  );
}
