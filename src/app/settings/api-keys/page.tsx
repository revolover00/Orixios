/**
 * صفحة إدارة مفاتيح مزودي الذكاء الاصطناعي (مرحلة التطوير).
 *
 * - التخزين في طبقة مستقلة عن المكونات (user-keys-storage) عبر
 *   اشتراك تفاعلي مستقر يعمل مع التصيير الخادمي دون أخطاء "window".
 * - القيمة الكاملة للمفتاح لا تُعرض بعد الحفظ أبدًا.
 * - حالات "مستنفد" و"غير صالح" تُحدَّث تلقائيًا من طبقة BYOK عبر
 *   الاستخدام الفعلي في الشات، وليس من هذه الصفحة مباشرة.
 */

'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ApiKeyForm } from '@/components/settings/api-key-form';
import { ApiKeyList } from '@/components/settings/api-key-list';
import {
  DeleteApiKeyDialog,
  type DeleteApiKeyTarget,
} from '@/components/settings/delete-api-key-dialog';
import {
  deleteApiKey,
  getEmptyPublicApiKeys,
  getPublicApiKeysSnapshot,
  renameApiKey,
  setDefaultApiKey,
  subscribeToApiKeysChanges,
  updateApiKeyStatus,
} from '@/lib/ai-providers/user-keys-storage';
import type { PublicUserApiKey } from '@/types/providers';

export default function ApiKeysSettingsPage() {
  // المفاتيح حالة خارجية تُقرأ باشتراك تفاعلي، مع لقطة خادم فارغة
  // حتى يتطابق التصيير الأولي ثم يتحدث تلقائيًا بعد التحميل.
  const keys = useSyncExternalStore(
    subscribeToApiKeysChanges,
    getPublicApiKeysSnapshot,
    getEmptyPublicApiKeys,
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteApiKeyTarget | null>(null);

  const handleSetDefault = useCallback((id: string) => {
    setDefaultApiKey(id);
  }, []);

  const handleRename = useCallback((id: string, label: string) => {
    return renameApiKey(id, label);
  }, []);

  const handleReactivate = useCallback((id: string) => {
    updateApiKeyStatus(id, 'active');
  }, []);

  const handleDeleteRequest = useCallback((key: PublicUserApiKey) => {
    setDeleteTarget({ id: key.id, label: key.label, keyPreview: key.keyPreview });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteApiKey(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">مفاتيح مزودي الذكاء الاصطناعي</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            مفاتيحك الخاصة بنظام احضر مفتاحك بنفسك (BYOK)
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-border px-3.5 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
        >
          الرئيسية
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-6 text-foreground">
        ملاحظة: تُحفَظ المفاتيح حاليًا في متصفحك، وهذا مناسب للتطوير فقط. مفاتيح
        الإنتاج ستُخزَّن لاحقًا عبر خادم آمن أو Supabase Vault بحل مشفر. لا تضع
        مفتاحًا حقيقيًا في ملفات المشروع أو في نظام التحكم بالإصدارات.
      </div>

      <div className="mt-6">
        <ApiKeyForm />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">المفاتيح المحفوظة</h2>
          <p className="text-[11px] text-muted-foreground">
            حالَتا «مستنفد» و«غير صالح» تُحدّثان تلقائيًا من نتائج الاستخدام الفعلي.
          </p>
        </div>
        <ApiKeyList
          keys={keys}
          onSetDefault={handleSetDefault}
          onDeleteRequest={handleDeleteRequest}
          onRename={handleRename}
          onReactivate={handleReactivate}
        />
      </section>

      <DeleteApiKeyDialog
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
