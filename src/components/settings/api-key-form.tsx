/**
 * Form for adding a new key.
 *
 * - Validation via Zod (provider required, non-empty label, non-empty key).
 * - Prevent saving a key for an inactive provider, and prevent duplicate keys with a message
 *   that does not reveal the value.
 * - The full key is not displayed after saving, and the field is cleared immediately upon success.
 * - The key is not sent to any external service from this page.
 */

'use client';

import { useState, type FormEvent } from 'react';
import {
  addApiKey,
  hasDuplicateApiKey,
  setDefaultApiKey,
} from '@/lib/ai-providers/user-keys-storage';
import { apiKeyFormSchema } from '@/lib/validation/tutor-schemas';
import type { ProviderName } from '@/types/providers';
import { ProviderSelect } from './provider-selector';

export function ApiKeyForm() {
  const [provider, setProvider] = useState<ProviderName>('gemini');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearForm = () => {
    setLabel('');
    setApiKey('');
    setMakeDefault(false);
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const parsed = apiKeyFormSchema.safeParse({ provider, label, apiKey });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setFormError(firstIssue?.message ?? 'تحقق من بيانات النموذج.');
      return;
    }

    if (hasDuplicateApiKey(parsed.data.provider, parsed.data.apiKey)) {
      setFormError('يوجد مفتاح بنفس القيمة محفوظًا مسبقًا لهذا المزود.');
      return;
    }

    const created = addApiKey(parsed.data);
    // The first key automatically becomes default within the storage layer,
    // and the explicit option enforces default when needed.
    if (makeDefault) {
      setDefaultApiKey(created.id);
    }

    // Clear the field from visual memory immediately upon successful save.
    setLabel('');
    setApiKey('');
    setMakeDefault(false);
    setSuccessMessage('تم حفظ المفتاح. لن تظهر قيمته الكاملة بعد الآن.');
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-bold text-foreground">إضافة مفتاح جديد</h2>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="new-key-provider" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            المزود
          </label>
          <ProviderSelect id="new-key-provider" value={provider} onChange={setProvider} />
        </div>

        <div>
          <label htmlFor="new-key-label" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            اسم وصفي للمفتاح
          </label>
          <input
            id="new-key-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="مثال: مفتاح المذاكرة"
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="new-key-api-key" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            قيمة المفتاح
          </label>
          <input
            id="new-key-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="ألصق المفتاح هنا"
            dir="ltr"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-left text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            لن تظهر القيمة كاملة بعد الحفظ، ولن تُرسل إلى أي خدمة خارجية من هذه الصفحة.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="new-key-default"
            type="checkbox"
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          <label htmlFor="new-key-default" className="text-xs text-muted-foreground">
            تعيينه المفتاح الافتراضي
          </label>
        </div>

        {formError ? (
          <p className="text-xs text-danger sm:col-span-2" role="alert">
            {formError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="text-xs text-success sm:col-span-2" role="status">
            {successMessage}
          </p>
        ) : null}

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            حفظ المفتاح
          </button>
          <button
            type="button"
            onClick={clearForm}
            className="rounded-xl border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          >
            مسح النموذج
          </button>
        </div>
      </form>
    </section>
  );
}
