/**
 * Chat request after Zod validation.
 *
 * Trust rules:
 * - No "system prompt" or "subjectName" is taken from the client;
 *   only "user" and "assistant" messages are allowed.
 * - Message IDs sent from the client are ignored (not trusted or used).
 * - The subject name comes from the session and catalog in the service layer.
 */

import type { UserKeyCredential } from '@/types/providers';
import type { SubjectId } from '@/types/sessions';
import type { ChatMessage } from '@/types/tutor';
import type { TutorChatRequestInput } from '@/lib/validation/tutor-schemas';

export interface TutorRequest {
  sessionId: string;
  subjectId: SubjectId;
  messages: ChatMessage[];
  currentTopic?: string;
  /**
   * Valid user keys (sorted: default first).
   * Necessary in the phase of storing keys in the browser, and will later be replaced
   * by secure fetching via Supabase from the server side.
   */
  keys: UserKeyCredential[];
}

/** Converts the validated body into a service request, dropping untrusted parts. */
export function toTutorRequest(validated: TutorChatRequestInput): TutorRequest {
  return {
    sessionId: validated.sessionId,
    subjectId: validated.subjectId,
    messages: validated.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    currentTopic: validated.currentTopic,
    keys: validated.keys,
  };
}
