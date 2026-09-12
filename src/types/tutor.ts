/**
 * Tutor chat types: messages and error codes.
 * The response contract itself is defined in "@/lib/tutor/tutor-response".
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Message displayed in the chat interface. */
export interface TutorMessage extends ChatMessage {
  id: string;
  /** Send time in ISO format. */
  sentAt: string;
}

/** Message status in the interface: sending, streaming, or failed. */
export type UiMessageStatus = 'sending' | 'streaming' | 'failed';

/** Chat interface message with its status if any. */
export interface UiChatMessage extends TutorMessage {
  status?: UiMessageStatus;
}

/** Standard chat errors understood by the interface. */
export type TutorErrorCode =
  | 'NO_API_KEY'
  | 'ALL_KEYS_EXHAUSTED'
  | 'INVALID_API_KEY'
  | 'SUBJECT_LOCKED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ENDED'
  | 'INVALID_SUBJECT'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PROVIDER_UNKNOWN'
  | 'INTERNAL_ERROR';
