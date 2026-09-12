/**
 * اختيار مزود الذكاء الاصطناعي في نموذج إضافة المفتاح.
 * - Gemini مفعّل.
 * - OpenRouter وGitHub Models عناصر نائبة تظهر بحالة "غير متاح حاليًا"
 *   ويُمنع الحفظ لها.
 * - أداة المحاكاة التطويرية المحلية خيار تطوير منفصل (ليست خدمة خارجية).
 */

'use client';

import { PROVIDERS } from '@/lib/ai-providers/provider-config';
import type { ProviderName } from '@/types/providers';

interface ProviderSelectProps {
  id: string;
  value: ProviderName;
  onChange: (provider: ProviderName) => void;
}

export function ProviderSelect({ id, value, onChange }: ProviderSelectProps) {
  const providers = Object.values(PROVIDERS);
  const selected = PROVIDERS[value];

  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ProviderName)}
        className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {providers.map((definition) => (
          <option key={definition.name} value={definition.name} disabled={definition.isPlaceholder}>
            {definition.displayName}
            {definition.isPlaceholder ? ' (غير متاح حاليًا)' : ''}
            {definition.isSimulation ? ' (محاكاة محلية للتطوير)' : ''}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
        {selected.description}
        {selected.isPlaceholder
          ? ' لا يمكن حفظ مفاتيح لهذا المزود قبل تفعيله الفعلي.'
          : ''}
      </p>
    </div>
  );
}
