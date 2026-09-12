/**
 * Zod schemas for input validation.
 */

import { z } from 'zod';
import { PROVIDERS } from '@/lib/ai-providers/provider-config';
import { PROVIDER_NAMES } from '@/types/providers';
import { SUBJECT_IDS } from '@/types/sessions';

/**
 * A single message from the client.
 * - Allowed roles: user and assistant only; any other role
 *   (like system, tool, or developer) is immediately rejected.
 * - Message ID is optional and ignored server-side (not trusted).
 */
export const chatMessageSchema = z.object({
  id: z.string().max(128).optional(),
  role: z.enum(['user', 'assistant'], {
    error: 'نوع الرسالة يجب أن يكون user أو assistant فقط',
  }),
  content: z
    .string()
    .trim()
    .min(1, 'محتوى الرسالة مطلوب')
    .max(6000, 'الرسالة طويلة جدًا'),
});

export const userKeyCredentialSchema = z.object({
  id: z.string().min(1).max(128),
  provider: z.enum(PROVIDER_NAMES),
  apiKey: z
    .string()
    .min(8, 'قيمة المفتاح قصيرة جدًا')
    .max(512, 'قيمة المفتاح طويلة جدًا'),
});

/** Schema for POST /api/tutor request body */
export const tutorChatRequestSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(8, 'معرّف الجلسة مطلوب (8 محارف على الأقل)')
    .max(128),
  subjectId: z.enum(SUBJECT_IDS, {
    error: 'المادة غير صالحة',
  }),
  messages: z
    .array(chatMessageSchema)
    .min(1, 'يجب إرسال رسالة واحدة على الأقل')
    .max(100, 'عدد الرسائل في الطلب الواحد كبير جدًا'),
  currentTopic: z.string().trim().min(1).max(200).optional(),
  keys: z.array(userKeyCredentialSchema).max(20).default([]),
  /** Optional: "true" returns a streaming response (SSE), its absence maintains normal behavior. */
  stream: z.boolean().optional(),
});

export type TutorChatRequestInput = z.infer<typeof tutorChatRequestSchema>;

/** Schema for adding a key form in the settings page (client-side validation). */
export const addApiKeySchema = z.object({
  provider: z.enum(PROVIDER_NAMES, { error: 'اختر مزودًا من القائمة المسموحة' }),
  label: z
    .string()
    .trim()
    .min(1, 'التسمية مطلوبة ولا يمكن أن تكون مسافات فقط')
    .max(60, 'التسمية طويلة جدًا'),
  apiKey: z
    .string()
    .trim()
    .min(8, 'قيمة المفتاح قصيرة جدًا أو فارغة (8 محارف على الأقل)')
    .max(512, 'قيمة المفتاح طويلة جدًا'),
});

export type AddApiKeyInput = z.infer<typeof addApiKeySchema>;

/**
 * Schema for adding a key form in the settings page, preventing saving a key for an inactive provider
 * (placeholders like OpenRouter and GitHub Models).
 */
export const apiKeyFormSchema = addApiKeySchema.superRefine((value, ctx) => {
  const definition = PROVIDERS[value.provider];
  if (!definition || definition.enabled !== true || definition.isPlaceholder) {
    ctx.addIssue({
      code: 'custom',
      path: ['provider'],
      message: 'هذا المزود غير متاح للحفظ في هذه المرحلة.',
    });
  }
});

export type ApiKeyFormInput = z.infer<typeof apiKeyFormSchema>;

/** Schema for selecting an existing key (valid ID check). */
export const selectKeySchema = z.object({
  keyId: z.string().trim().min(1, 'معرّف المفتاح مطلوب').max(128),
});

export type SelectKeyInput = z.infer<typeof selectKeySchema>;

/** Provider selection schema. */
export const providerNameSchema = z.enum(PROVIDER_NAMES, {
  error: 'اسم المزود غير صالح',
});

export const selectProviderSchema = z.object({
  provider: providerNameSchema,
});

export type SelectProviderInput = z.infer<typeof selectProviderSchema>;

/** Summarizes Zod error messages into a short, displayable text. */
export function summarizeZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.join('.') || 'الطلب';
      return `${path}: ${issue.message}`;
    })
    .join('؛ ');
}
