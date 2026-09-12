/**
 * Grounded knowledge layer errors + standard message for out-of-source.
 */

export type KnowledgeErrorCode = 'UNKNOWN_SUBJECT' | 'NO_CONTENT_AVAILABLE';

export const KNOWLEDGE_ERROR_MESSAGES: Record<KnowledgeErrorCode, string> = {
  UNKNOWN_SUBJECT: 'المادة المطلوبة غير معروفة في نظام المعرفة.',
  NO_CONTENT_AVAILABLE: 'لا يوجد محتوى موثوق متاح لهذا الطلب.',
};

export interface KnowledgeErrorOptions {
  subjectId?: string;
  topic?: string;
  message?: string;
}

export class KnowledgeError extends Error {
  readonly code: KnowledgeErrorCode;
  readonly subjectId?: string;
  readonly topic?: string;

  constructor(code: KnowledgeErrorCode, options?: KnowledgeErrorOptions) {
    super(options?.message ?? KNOWLEDGE_ERROR_MESSAGES[code]);
    this.name = 'KnowledgeError';
    this.code = code;
    this.subjectId = options?.subjectId;
    this.topic = options?.topic;
  }
}

/**
 * The only standard message used when the snippet is outside the available source.
 * Defined here only once and not repeated in other files.
 */
export const OUT_OF_SOURCE_MESSAGE = 'الجزئية دي مش موجودة في المصدر المتاح حاليًا.';
