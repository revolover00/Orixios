/**
 * عقد الاستجابات الموحّد لواجهة الشات.
 *
 * ما لا يجب أن يظهر في أي استجابة:
 * - مفاتيح API أو جزء منها.
 * - الـ system prompt أو السياق الموثوق الكامل.
 * - أي stack trace أو تفاصيل داخلية عن اختيار المفاتيح.
 *
 * "keyStatusUpdates" تحمل فقط معرّفات المفاتيح وحالاتها (بلا قيم)
 * حتى يطبّقها العميل على تخزينه المحلي في مرحلة التطوير.
 */

import type { KeyStatusUpdate } from '@/types/providers';
import type { TutorErrorCode } from '@/types/tutor';

export interface TutorAssistantMessage {
  role: 'assistant';
  content: string;
}

export interface TutorUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface TutorSuccessData {
  message: TutorAssistantMessage;
  reasoning?: string;
  usage?: TutorUsage;
}

export interface TutorSuccessResponse {
  success: true;
  data: TutorSuccessData;
  keyStatusUpdates: KeyStatusUpdate[];
}

export interface TutorErrorBody {
  code: TutorErrorCode;
  message: string;
  retryable: boolean;
}

export interface TutorErrorResponse {
  success: false;
  error: TutorErrorBody;
  keyStatusUpdates: KeyStatusUpdate[];
}

export type TutorApiResponse = TutorSuccessResponse | TutorErrorResponse;

export function buildSuccessResponse(
  data: TutorSuccessData,
  keyStatusUpdates: KeyStatusUpdate[] = [],
): TutorSuccessResponse {
  return { success: true, data, keyStatusUpdates };
}

export function buildErrorResponse(
  error: TutorErrorBody,
  keyStatusUpdates: KeyStatusUpdate[] = [],
): TutorErrorResponse {
  return { success: false, error, keyStatusUpdates };
}
