/**
 * تحويل الأخطاء الداخلية إلى أخطاء آمنة وموحّدة للواجهة.
 *
 * قواعد صارمة:
 * - لا يُعرض النص الخام لأي خطأ، ولا أي stack trace.
 * - لا تُذكر أسماء متغيرات البيئة أو قيمها.
 * - لا تظهر قيم المفاتيح في أي رسالة.
 * - غياب المصدر الموثوق ليس خطأ تقنيًا؛ لا يُنتج خطأ من هنا.
 */

import type { ProviderError } from '@/lib/ai-providers/errors';
import type { SessionError } from '@/lib/sessions/session-errors';
import type { TutorErrorCode } from '@/types/tutor';
import type { TutorApiResponse, TutorErrorBody } from './tutor-response';

export const TUTOR_ERROR_HTTP_STATUS: Record<TutorErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_SUBJECT: 404,
  SESSION_NOT_FOUND: 404,
  SESSION_ENDED: 409,
  SUBJECT_LOCKED: 409,
  NO_API_KEY: 403,
  INVALID_API_KEY: 401,
  ALL_KEYS_EXHAUSTED: 429,
  NETWORK_ERROR: 503,
  PROVIDER_UNKNOWN: 502,
  INTERNAL_ERROR: 500,
};

/** هل يمكن للطالب إعادة المحاولة فورًا بنفس المفاتيح؟ */
const RETRYABLE_CODES: ReadonlySet<TutorErrorCode> = new Set<TutorErrorCode>([
  'NETWORK_ERROR',
]);

const SAFE_MESSAGES: Record<TutorErrorCode, string> = {
  VALIDATION_ERROR: 'فشل التحقق من صحة الطلب.',
  INVALID_SUBJECT: 'المادة غير صالحة أو غير متاحة.',
  SESSION_NOT_FOUND: 'الجلسة غير موجودة. ابدأ جلسة جديدة.',
  SESSION_ENDED: 'الجلسة منتهية ولا يمكن استخدامها. ابدأ جلسة جديدة.',
  SUBJECT_LOCKED: 'لا يمكن تغيير المادة داخل نفس الجلسة. ابدأ جلسة جديدة للمادة المطلوبة.',
  NO_API_KEY: 'لا يوجد مفتاح لاستخدامه. أضف مفتاحًا من صفحة الإعدادات.',
  INVALID_API_KEY: 'مفتاح الواجهة غير صالح أو غير مصرح له. راجع المفتاح في صفحة الإعدادات.',
  ALL_KEYS_EXHAUSTED: 'استنفدت جميع المفاتيح المتاحة أو أصبحت غير صالحة. أضف مفتاحًا جديدًا من الإعدادات.',
  NETWORK_ERROR: 'تعذر الاتصال بالمزود. تحقق من الشبكة ثم حاول مرة أخرى.',
  PROVIDER_UNKNOWN: 'المزود غير مهيأ أو غير مفعّل في هذه المرحلة.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};

export function safeTutorError(
  code: TutorErrorCode,
  message?: string,
): TutorErrorBody {
  return {
    code,
    message: message ?? SAFE_MESSAGES[code],
    retryable: RETRYABLE_CODES.has(code),
  };
}

/** ترجمة أخطاء المزودات إلى أخطاء الشات الآمنة. */
export function providerErrorToTutorError(error: ProviderError): TutorErrorBody {
  switch (error.code) {
    case 'NO_API_KEY':
      return safeTutorError('NO_API_KEY');
    case 'ALL_KEYS_EXHAUSTED':
    case 'QUOTA_EXCEEDED':
      return safeTutorError('ALL_KEYS_EXHAUSTED');
    case 'INVALID_API_KEY':
      return safeTutorError('INVALID_API_KEY');
    case 'NETWORK_ERROR':
      return safeTutorError('NETWORK_ERROR');
    case 'PROVIDER_NOT_CONFIGURED':
      return safeTutorError('PROVIDER_UNKNOWN');
  }
}

/** ترجمة أخطاء الجلسات إلى أخطاء الشات الآمنة. */
export function sessionErrorToTutorError(
  error: SessionError,
  sessionSubjectName?: string,
): TutorErrorBody {
  switch (error.code) {
    case 'SESSION_NOT_FOUND':
      return safeTutorError('SESSION_NOT_FOUND');
    case 'SESSION_ENDED':
      return safeTutorError('SESSION_ENDED');
    case 'SUBJECT_MISMATCH': {
      const base = 'لا يمكن تغيير المادة داخل نفس الجلسة.';
      const message = sessionSubjectName
        ? `${base} هذه الجلسة مخصصة لمادة ${sessionSubjectName}، وتغيير المادة يتطلب بدء جلسة جديدة.`
        : base;
      return safeTutorError('SUBJECT_LOCKED', message);
    }
    case 'INVALID_SUBJECT':
      return safeTutorError('INVALID_SUBJECT');
    case 'SESSION_ALREADY_EXISTS':
      return safeTutorError('VALIDATION_ERROR');
  }
}

/** خطأ عام لأي استثناء غير متوقع — رسالة عامة بلا أي تفاصيل، وحالة 500. */
export function unknownErrorToTutorError(): TutorErrorBody {
  return safeTutorError('INTERNAL_ERROR');
}

/** حالة HTTP المناسبة لأي استجابة. */
export function httpStatusForResponse(response: TutorApiResponse): number {
  if (response.success) {
    return 200;
  }
  return TUTOR_ERROR_HTTP_STATUS[response.error.code];
}
