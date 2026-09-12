/**
 * Unified response contract for the chat interface.
 *
 * What should not appear in any response:
 * - API keys or part of them.
 * - The system prompt or the full grounded context.
 * - Any stack trace or internal details about key selection.
 *
 * "keyStatusUpdates" only contains key IDs and their statuses (without values)
 * so that the client can apply them to its local storage in the development phase.
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
