/**
 * Single key card: Name, Provider, Status, Date, Default,
 * and only a masked preview (full value is never displayed after saving).
 */

'use client';

import { useState } from 'react';
import { PROVIDERS } from '@/lib/ai-providers/provider-config';
import type { ApiKeyStatus, PublicUserApiKey } from '@/types/providers';

export const KEY_STATUS_META: Record<ApiKeyStatus, { label: string; className: string }> = {
  active: { label: 'نشط', className: 'border-success/40 bg-success/10 text-success' },
  exhausted: { label: 'مستنفد', className: 'border-warning/40 bg-warning/10 text-warning' },
  invalid: { label: 'غير صالح', className: 'border-danger/40 bg-danger/10 text-danger' },
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'تاريخ غير معروف';
  }
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export interface ApiKeyCardProps {
  apiKey: PublicUserApiKey;
  onSetDefault: (id: string) => void;
  onDeleteRequest: (key: PublicUserApiKey) => void;
  onRename: (id: string, label: string) => boolean;
  onReactivate: (id: string) => void;
}

export function ApiKeyCard({
  apiKey,
  onSetDefault,
  onDeleteRequest,
  onRename,
  onReactivate,
}: ApiKeyCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(apiKey.label);
  const [renameError, setRenameError] = useState<string | null>(null);

  const provider = PROVIDERS[apiKey.provider];
  const status = KEY_STATUS_META[apiKey.status];

  const startRenaming = () => {
    setDraftLabel(apiKey.label);
    setRenameError(null);
    setIsRenaming(true);
  };

  const saveRename = () => {
    const trimmed = draftLabel.trim();
    if (trimmed.length < 2) {
      setRenameError('التسمية مطلوبة (حرفان على الأقل).');
      return;
    }
    if (onRename(apiKey.id, trimmed)) {
      setIsRenaming(false);
      setRenameError(null);
    } else {
      setRenameError('تعذر حفظ التسمية الجديدة.');
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {isRenaming ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`rename-${apiKey.id}`} className="sr-only">
                التسمية الجديدة للمفتاح
              </label>
              <input
                id={`rename-${apiKey.id}`}
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                className="w-48 rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm text-foreground focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={saveRename}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{apiKey.label}</h3>
              {apiKey.isDefault ? (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  الافتراضي
                </span>
              ) : null}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          )}
          {renameError ? (
            <p className="mt-1 text-[11px] text-danger" role="alert">
              {renameError}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            {provider.displayName} · <span dir="ltr">{apiKey.keyPreview}</span> · أُضيف في{' '}
            {formatDate(apiKey.createdAt)}
          </p>
          {apiKey.status !== 'active' ? (
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              الحالة تتحدث تلقائيًا من نتائج الاستخدام الفعلي، ويمكن إعادتها إلى نشط يدويًا
              وسيُختبر المفتاح عند أول استخدام.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {!apiKey.isDefault ? (
          <button
            type="button"
            onClick={() => onSetDefault(apiKey.id)}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            تعيين كافتراضي
          </button>
        ) : null}
        {!isRenaming ? (
          <button
            type="button"
            onClick={startRenaming}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            إعادة تسمية
          </button>
        ) : null}
        {apiKey.status !== 'active' ? (
          <button
            type="button"
            onClick={() => onReactivate(apiKey.id)}
            className="rounded-lg border border-primary/40 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            إعادة التعيين إلى نشط
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDeleteRequest(apiKey)}
          aria-label={`حذف المفتاح ${apiKey.label}`}
          className="rounded-lg border border-danger/40 px-3 py-1.5 text-[11px] text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-ring/60"
        >
          حذف
        </button>
      </div>
    </article>
  );
}
