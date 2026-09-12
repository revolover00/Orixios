/**
 * قائمة بطاقات المفاتيح مع حالة "لا توجد مفاتيح".
 */

'use client';

import type { PublicUserApiKey } from '@/types/providers';
import { ApiKeyCard, type ApiKeyCardProps } from './api-key-card';

export interface ApiKeyListProps {
  keys: PublicUserApiKey[];
  onSetDefault: ApiKeyCardProps['onSetDefault'];
  onDeleteRequest: ApiKeyCardProps['onDeleteRequest'];
  onRename: ApiKeyCardProps['onRename'];
  onReactivate: ApiKeyCardProps['onReactivate'];
}

export function ApiKeyList({
  keys,
  onSetDefault,
  onDeleteRequest,
  onRename,
  onReactivate,
}: ApiKeyListProps) {
  if (keys.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">لا توجد مفاتيح محفوظة بعد</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          أضف مفتاحًا من النموذج أعلاه لبدء استخدام المدرّس. يمكنك إضافة مفتاح تجريبي
          لمزود المحاكاة أو مفتاح Gemini الخاص بك، ولن تظهر قيمته الكاملة بعد الحفظ.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="المفاتيح المحفوظة">
      {keys.map((key) => (
        <li key={key.id}>
          <ApiKeyCard
            apiKey={key}
            onSetDefault={onSetDefault}
            onDeleteRequest={onDeleteRequest}
            onRename={onRename}
            onReactivate={onReactivate}
          />
        </li>
      ))}
    </ul>
  );
}
