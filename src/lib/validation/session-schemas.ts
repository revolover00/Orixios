/**
 * Zod schemas for session and subject domains.
 * Rejects: empty values, spaces only, and unknown values.
 */

import { z } from 'zod';
import { SUBJECT_IDS } from '@/types/sessions';

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Student ID: non-empty and after trimming spaces. */
export const studentIdSchema = z
  .string()
  .trim()
  .min(1, 'معرّف الطالب مطلوب ولا يمكن أن يكون مسافات فقط')
  .max(128, 'معرّف الطالب طويل جدًا');

/** Subject ID: trimmed spaces and from the known list only. */
export const subjectIdSchema = z.preprocess(
  trimIfString,
  z.enum(SUBJECT_IDS, { error: 'المادة غير معروفة' }),
);

/** Session ID. */
export const sessionIdSchema = z
  .string()
  .trim()
  .min(8, 'معرّف الجلسة مطلوب (8 محارف على الأقل)')
  .max(128, 'معرّف الجلسة طويل جدًا');

/**
 * Validates the subject ID coming from the URL segment /session/[subjectId].
 * URL segments do not inherently contain extra spaces, but we apply the same strictness.
 */
export const urlSubjectIdSchema = z.preprocess(
  trimIfString,
  z.enum(SUBJECT_IDS, { error: 'المادة في الرابط غير صالحة' }),
);

/** Session creation body. */
export const createSessionSchema = z.object({
  studentId: studentIdSchema,
  subjectId: subjectIdSchema,
});

export type CreateSessionSchemaInput = z.infer<typeof createSessionSchema>;

/** Read session ID from a request. */
export const readSessionSchema = z.object({
  sessionId: sessionIdSchema,
});

export type ReadSessionSchemaInput = z.infer<typeof readSessionSchema>;
