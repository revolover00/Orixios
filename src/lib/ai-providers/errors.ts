/**
 * AI provider errors and their classification.
 *
 * Strict rules:
 * - Displayed messages are general and safe only; raw error text or any key is not leaked
 *   to the interface. Raw details are stored in 'cause' for internal server-side use.
 * - Errors or keys are not printed to the console in any path.
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

/** Safe general messages for display — do not include any raw details. */
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
  /** Safe general message only. Do not pass raw texts or secrets. */
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
 * Is the error caused by the user canceling the request?
 * Cancellation is not always an error, does not change the key status, and is not classified as a network error.
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
 * Classifies any error coming from a provider (or from AI SDK) into a ProviderError with a specific code.
 *
 * - 401/403 or Unauthorized → INVALID_API_KEY (not retryable)
 * - 429 or quotas/rate limits → QUOTA_EXCEEDED (retryable with another key)
 * - Network failures → NETWORK_ERROR (temporary, without changing key status)
 * - Otherwise → PROVIDER_NOT_CONFIGURED with a general message
 *
 * The resulting message is always general; the raw error remains in 'cause' internally only.
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
