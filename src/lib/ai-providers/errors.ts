/**
 * أخطاء مزودي الذكاء الاصطناعي وتصنيفها.
 *
 * قواعد صارمة:
 * - الرسائل المعروضة عامة وآمنة فقط؛ لا يُسرَّب نص الخطأ الخام ولا أي مفتاح
 *   إلى الواجهة. التفاصيل الخام تُحفَظ في cause للاستخدام الخادمي الداخلي.
 * - لا تُطبع الأخطاء أو المفاتيح في console في أي مسار.
 */

import type { ProviderName } from '@/types/providers';

export type ProviderErrorCode =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'ALL_KEYS_EXHAUSTED'
  | 'NETWORK_ERROR'
  | 'PROVIDER_NOT_CONFIGURED';

const RETRYABLE_CODES: ReadonlySet<ProviderErrorCode> = new Set<ProviderErrorCode>([
  'QUOTA_EXCEEDED',
  'NETWORK_ERROR',
]);

/** رسائل عامة آمنة للعرض — لا تتضمن أي تفاصيل خام. */
const SAFE_MESSAGES: Record<ProviderErrorCode, string> = {
  NO_API_KEY: 'لا يوجد مفتاح متاح للاستخدام.',
  INVALID_API_KEY: 'المفتاح غير صالح أو غير مصرح له.',
  QUOTA_EXCEEDED: 'تم استنفاد حصة المفتاح.',
  ALL_KEYS_EXHAUSTED: 'استنفدت جميع المفاتيح المتاحة.',
  NETWORK_ERROR: 'حدث خطأ اتصال مؤقت بالمزود.',
  PROVIDER_NOT_CONFIGURED: 'المزود غير مهيأ أو غير مفعّل.',
};

export interface ProviderErrorOptions {
  provider?: ProviderName;
  keyId?: string;
  cause?: unknown;
  /** رسالة عامة آمنة فقط. لا تمرر نصوصًا خام أو أسرارًا. */
  message?: string;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  provider?: ProviderName;
  keyId?: string;

  constructor(code: ProviderErrorCode, options?: ProviderErrorOptions) {
    super(options?.message ?? SAFE_MESSAGES[code], { cause: options?.cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = RETRYABLE_CODES.has(code);
    this.provider = options?.provider;
    this.keyId = options?.keyId;
  }
}

export function isRetryableProviderError(error: unknown): boolean {
  return error instanceof ProviderError && error.retryable;
}

/**
 * هل الخطأ ناتج عن إلغاء المستخدم للطلب؟
 * الإلغاء ليس خطأ دائمًا، ولا يغيّر حالة المفتاح، ولا يُصنَّف كخطأ شبكة.
 */
export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'AbortError') {
    return true;
  }
  return /\baborted?\b/i.test(error.message);
}

interface ErrorLike {
  statusCode?: unknown;
  status?: unknown;
  message?: unknown;
  cause?: unknown;
}

function readStatusCode(error: ErrorLike): number | null {
  const candidates = [
    error.statusCode,
    error.status,
    (error.cause as ErrorLike | undefined)?.statusCode,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * يصنّف أي خطأ قادم من مزود (أو من AI SDK) إلى ProviderError برمز محدد.
 *
 * - 401/403 أو Unauthorized ← INVALID_API_KEY (غير قابل لإعادة المحاولة)
 * - 429 أو حصص/حدود معدل ← QUOTA_EXCEEDED (قابل لإعادة المحاولة بمفتاح آخر)
 * - أعطال الشبكة ← NETWORK_ERROR (مؤقت، دون تغيير حالة المفتاح)
 * - غير ذلك ← PROVIDER_NOT_CONFIGURED برسالة عامة
 *
 * الرسالة الناتجة عامة دائمًا؛ الخطأ الخام يبقى في cause داخليًا فقط.
 */
export function classifyProviderError(error: unknown, provider?: ProviderName): ProviderError {
  if (error instanceof ProviderError) {
    if (provider && error.provider === undefined) {
      error.provider = provider;
    }
    return error;
  }

  const errorLike = (error ?? {}) as ErrorLike;
  const rawMessage = typeof errorLike.message === 'string' ? errorLike.message : String(error ?? '');
  const statusCode = readStatusCode(errorLike);

  if (
    statusCode === 429 ||
    /quota|rate.?limit|resource has been exhausted|too many requests/i.test(rawMessage)
  ) {
    return new ProviderError('QUOTA_EXCEEDED', { provider, cause: error });
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    /invalid api key|api key not valid|api key expired|unauthorized|permission denied/i.test(
      rawMessage,
    )
  ) {
    return new ProviderError('INVALID_API_KEY', { provider, cause: error });
  }

  if (
    error instanceof TypeError ||
    /fetch failed|network|ECONN|ENOTFOUND|socket hang up|timed? ?out/i.test(rawMessage)
  ) {
    return new ProviderError('NETWORK_ERROR', { provider, cause: error });
  }

  return new ProviderError('PROVIDER_NOT_CONFIGURED', { provider, cause: error });
}
