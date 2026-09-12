/**
 * اختيار المفتاح النشط + دورة الأخطاء والانتقال بين المفاتيح.
 *
 * الفصل الصارم: الاختيار (getActiveModel) قرار نقي لا يرسل طلبات،
 * والإرسال يتم عبر حقن دالة استدعاء في دورة الانتقال (runWithKeyRotation).
 * لا يعيش أي جزء من هذا المنطق داخل مكوّنات React.
 *
 * قواعد الاختيار:
 * 1. لا تُختار مفاتيح بحالة "invalid" أو "exhausted".
 * 2. المفتاح الافتراضي النشط أولًا، وإلا فأول مفتاح نشط.
 * 3. عند تحديد مزود، البحث داخله فقط.
 * 4. لا مفاتيح ← NO_API_KEY؛ ولا يُستخدم مفتاح البيئة إلا باجتماع
 *    DEV_TESTING_MODE=true مع خيار صريح بقبول الـ fallback.
 * 5. مفاتيح موجودة كلها مستنفدة/غير صالحة ← ALL_KEYS_EXHAUSTED.
 * 6. مفاتيح نشطة لمزود غير مفعّل ← PROVIDER_NOT_CONFIGURED.
 *
 * قواعد الانتقال:
 * - QUOTA_EXCEEDED: تعليم المفتاح "exhausted" وتجربة مفتاح نشط آخر،
 *   مرة واحدة فقط لكل مفتاح (عبر Set وحد أعلى للمحاولات) — لا حلقات مفتوحة.
 * - INVALID_API_KEY: تعليم المفتاح "invalid" والتوقف فورًا دون انتقال تلقائي.
 * - NETWORK_ERROR: لا تتغير حالة المفتاح، ويُعاد خطأ مؤقت.
 */

import type { ApiKeyStatus, KeyStatusUpdate, UserApiKey } from '@/types/providers';
import {
  getDevTestingFallbackKey,
  getProviderConfig,
  isDevTestingMode,
} from './provider-config';
import { ProviderError, classifyProviderError } from './errors';
import type {
  GetActiveModelOptions,
  KeyRotationOptions,
  KeyRotationOutcome,
  ProviderSelectionResult,
} from './types';
import { listApiKeys } from './user-keys-storage';

/** الحد الأعلى لعدد المفاتيح التي تُجرَّب في الطلب الواحد. */
export const MAX_KEY_ATTEMPTS = 5;

/**
 * يحاول استخدام مفتاح البيئة التطويري، ولا ينجح إلا باجتماع:
 * خيار صريح + وضع اختبار مفعّل + مفتاح بيئة غير فارغ + توافق المزود.
 * غير ذلك: لا يوجد أي fallback صامت إطلاقًا.
 */
function tryDevEnvironmentFallback(
  options: GetActiveModelOptions | undefined,
): ProviderSelectionResult | null {
  if (!options?.allowDevEnvironmentFallback) {
    return null;
  }
  if (!isDevTestingMode()) {
    return null;
  }
  const fallbackKey = getDevTestingFallbackKey();
  if (!fallbackKey) {
    return null;
  }
  if (options.preferredProvider && options.preferredProvider !== fallbackKey.provider) {
    return null;
  }
  return { key: fallbackKey, provider: getProviderConfig(fallbackKey.provider) };
}

/**
 * يختار المفتاح النشط الأنسب مع إعداد مزوده.
 *
 * يرمي ProviderError برموز:
 * - NO_API_KEY عندما لا توجد مفاتيح (ولم تتوفر شروط الـ fallback التطويري).
 * - ALL_KEYS_EXHAUSTED عندما توجد مفاتيح لكنها كلها غير صالحة/مستنفدة.
 * - PROVIDER_NOT_CONFIGURED عندما تكون المفاتيح النشطة لمزود غير مفعّل.
 *
 * لا تُغيَّر حالة أي مفتاح داخل هذه الدالة؛ هي قراءة واختيار فقط.
 */
export function getActiveModel(options?: GetActiveModelOptions): ProviderSelectionResult {
  const sourceKeys = options?.keys ?? listApiKeys();
  const scopedKeys = options?.preferredProvider
    ? sourceKeys.filter((key) => key.provider === options.preferredProvider)
    : sourceKeys;

  if (scopedKeys.length === 0) {
    const fallback = tryDevEnvironmentFallback(options);
    if (fallback) {
      return fallback;
    }
    throw new ProviderError('NO_API_KEY');
  }

  const activeKeys = scopedKeys.filter((key) => key.status === 'active');
  if (activeKeys.length === 0) {
    // توجد مفاتيح لكنها كلها مستنفدة أو غير صالحة.
    throw new ProviderError('ALL_KEYS_EXHAUSTED');
  }

  const configuredKeys = activeKeys.filter(
    (key) => getProviderConfig(key.provider).enabled === true,
  );
  if (configuredKeys.length === 0) {
    // مفاتيح نشطة لكن مزودها عنصر نائب غير مفعّل.
    throw new ProviderError('PROVIDER_NOT_CONFIGURED', {
      provider: activeKeys[0]?.provider,
    });
  }

  const selectedKey = configuredKeys.find((key) => key.isDefault) ?? configuredKeys[0];
  return { key: selectedKey, provider: getProviderConfig(selectedKey.provider) };
}

/**
 * دورة الأخطاء والانتقال بين المفاتيح.
 *
 * - تختار وتنفذ، وتجمع تحديثات حالات المفاتيح لإرجاعها للمتصل
 *   (الخادم مثلًا يعيدها للعميل ليطبقها في التخزين).
 * - عدد المحاولات محدود، وSet يمنع تجربة نفس المفتاح مرتين.
 * - الأخطاء المعادة عامة وآمنة؛ لا تُكشف قيم المفاتيح أو النصوص الخام.
 */
export async function runWithKeyRotation(options: KeyRotationOptions): Promise<KeyRotationOutcome> {
  const { invoke, preferredProvider, onKeyStatusChange } = options;
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? MAX_KEY_ATTEMPTS, MAX_KEY_ATTEMPTS),
  );

  let workingKeys: UserApiKey[] = [...options.keys];
  const attemptedKeyIds = new Set<string>();
  const keyStatusUpdates: KeyStatusUpdate[] = [];

  const markKeyStatus = (keyId: string, status: ApiKeyStatus) => {
    keyStatusUpdates.push({ keyId, status });
    workingKeys = workingKeys.map((key) => (key.id === keyId ? { ...key, status } : key));
    if (onKeyStatusChange) {
      onKeyStatusChange(keyId, status);
    }
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let selection: ProviderSelectionResult;
    try {
      selection = getActiveModel({ keys: workingKeys, preferredProvider });
    } catch (error) {
      const providerError =
        error instanceof ProviderError ? error : new ProviderError('ALL_KEYS_EXHAUSTED');
      return { ok: false, error: providerError, keyStatusUpdates };
    }

    // حماية إضافية ضد تكرار تجربة نفس المفتاح (الـ Set + حد المحاولات).
    if (attemptedKeyIds.has(selection.key.id)) {
      return {
        ok: false,
        error: new ProviderError('ALL_KEYS_EXHAUSTED'),
        keyStatusUpdates,
      };
    }
    attemptedKeyIds.add(selection.key.id);

    try {
      const text = await invoke(selection.key);
      return {
        ok: true,
        text,
        usedKeyId: selection.key.id,
        provider: selection.provider.name,
        keyStatusUpdates,
      };
    } catch (error) {
      const providerError = classifyProviderError(error, selection.key.provider);
      providerError.keyId = selection.key.id;

      if (providerError.code === 'QUOTA_EXCEEDED') {
        // نُعلّم المفتاح مستنفدًا وننتقل مرة واحدة إلى مفتاح نشط آخر.
        markKeyStatus(selection.key.id, 'exhausted');
        continue;
      }

      if (providerError.code === 'INVALID_API_KEY') {
        // نُعلّم المفتاح غير صالح ونتوقف فورًا: لا انتقال تلقائيًا.
        markKeyStatus(selection.key.id, 'invalid');
        return { ok: false, error: providerError, keyStatusUpdates };
      }

      // NETWORK_ERROR أو أي خطأ آخر: لا تغيير لحالة المفتاح، خطأ مؤقت.
      return { ok: false, error: providerError, keyStatusUpdates };
    }
  }

  // استُهلك حد المحاولات (كل المفاتيح المجرّبة استُنفدت).
  return {
    ok: false,
    error: new ProviderError('ALL_KEYS_EXHAUSTED'),
    keyStatusUpdates,
  };
}
