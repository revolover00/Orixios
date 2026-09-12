/**
 * أخطاء نطاق الجلسات.
 * الرسائل عامة وواضحة، ولا تكشف أي تفاصيل داخلية حساسة.
 */

import type { SessionErrorCode } from '@/types/sessions';

export const SESSION_ERROR_MESSAGES: Record<SessionErrorCode, string> = {
  SESSION_NOT_FOUND: 'الجلسة غير موجودة.',
  SESSION_ENDED: 'الجلسة منتهية ولا يمكن استخدامها.',
  SUBJECT_MISMATCH: 'لا يمكن تغيير المادة داخل نفس الجلسة.',
  INVALID_SUBJECT: 'المادة غير صالحة أو غير متاحة.',
  SESSION_ALREADY_EXISTS: 'توجد جلسة بهذا المعرّف بالفعل.',
};

export interface SessionErrorOptions {
  sessionId?: string;
  subjectId?: string;
  message?: string;
}

export class SessionError extends Error {
  readonly code: SessionErrorCode;
  readonly sessionId?: string;
  readonly subjectId?: string;

  constructor(code: SessionErrorCode, options?: SessionErrorOptions) {
    super(options?.message ?? SESSION_ERROR_MESSAGES[code]);
    this.name = 'SessionError';
    this.code = code;
    this.sessionId = options?.sessionId;
    this.subjectId = options?.subjectId;
  }
}
