/**
 * Client layer for connecting to the chat interface and session interfaces.
 *
 * Rules:
 * - All request logic is here, not within display components.
 * - The shape of any response is validated before being used in the interface.
 * - Keys or sensitive responses are not displayed or logged anywhere.
 * - "system", "developer", or "tool" messages are never sent from the interface;
 *   the only two possible message roles from the browser are "user" and "assistant".
 *
 * Note on the "keys" field: Valid keys are collected from the storage layer
 * (current development phase) and are not derived from user input for each message,
 * and will later transition to secure fetching via Supabase from the server side.
 */

import { API_KEY_STATUSES, type KeyStatusUpdate, type UserKeyCredential } from '@/types/providers';
import type { ChatMessage, TutorErrorCode } from '@/types/tutor';
import type { TutorApiResponse, TutorUsage } from './tutor-response';
import { parseSseBlock } from './tutor-stream';

export interface TutorChatPayload {
  sessionId: string;
  subjectId: string;
  messages: ChatMessage[];
  currentTopic?: string;
  keys: UserKeyCredential[];
}

export interface CreateSessionResult {
  sessionId: string;
  subjectId: string;
  subjectName: string;
}

/** Invalid transfer/response error — does not reveal internal details. */
export class TutorClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TutorClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseUsage(value: unknown): TutorUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const usage: TutorUsage = {};
  if (typeof value.inputTokens === 'number' && Number.isFinite(value.inputTokens)) {
    usage.inputTokens = value.inputTokens;
  }
  if (typeof value.outputTokens === 'number' && Number.isFinite(value.outputTokens)) {
    usage.outputTokens = value.outputTokens;
  }
  return usage.inputTokens !== undefined || usage.outputTokens !== undefined ? usage : undefined;
}

/** Strict validation of key status updates before passing them to the storage layer. */
function parseKeyStatusUpdates(value: unknown): KeyStatusUpdate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const updates: KeyStatusUpdate[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    if (typeof entry.keyId !== 'string' || entry.keyId.length === 0) {
      continue;
    }
    if (
      typeof entry.status !== 'string' ||
      !(API_KEY_STATUSES as readonly string[]).includes(entry.status)
    ) {
      continue;
    }
    updates.push({ keyId: entry.keyId, status: entry.status as KeyStatusUpdate['status'] });
  }
  return updates;
}

/**
 * Strict validation of the /api/tutor response shape before using it.
 * Returns "null" for any unexpected shape so that untrusted data is not consumed.
 */
export function parseTutorApiResponse(raw: unknown): TutorApiResponse | null {
  if (!isRecord(raw) || typeof raw.success !== 'boolean') {
    return null;
  }

  if (raw.success) {
    if (!isRecord(raw.data) || !isRecord(raw.data.message)) {
      return null;
    }
    const message = raw.data.message;
    if (message.role !== 'assistant' || typeof message.content !== 'string') {
      return null;
    }
    return {
      success: true,
      data: {
        message: { role: 'assistant', content: message.content },
        reasoning:
          typeof raw.data.reasoning === 'string' && raw.data.reasoning.length > 0
            ? raw.data.reasoning
            : undefined,
        usage: parseUsage(raw.data.usage),
      },
      keyStatusUpdates: parseKeyStatusUpdates(raw.keyStatusUpdates),
    };
  }

  if (!isRecord(raw.error)) {
    return null;
  }
  const error = raw.error;
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    return null;
  }
  return {
    success: false,
    error: {
      // Unknown codes are passed as is and handled by the interface via a safe general path.
      code: error.code as TutorErrorCode,
      message: error.message,
      retryable: error.retryable === true,
    },
    keyStatusUpdates: parseKeyStatusUpdates(raw.keyStatusUpdates),
  };
}

export async function postTutorChat(payload: TutorChatPayload): Promise<TutorApiResponse> {
  let response: Response;
  try {
    response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new TutorClientError('تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول مرة أخرى.');
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new TutorClientError('استجابة غير مفهومة من الخادم.');
  }

  const parsed = parseTutorApiResponse(raw);
  if (!parsed) {
    throw new TutorClientError('استجابة غير صالحة من الخادم.');
  }
  return parsed;
}

/* ------------------------------- Streaming Path -------------------------------- */

export interface TutorStreamHandlers {
  /** New text part from the tutor's response. */
  onToken: (text: string) => void;
  /** Stream completed successfully. */
  onDone: (info: { usage?: TutorUsage; keyStatusUpdates: KeyStatusUpdate[] }) => void;
  /** Unified error (before or during streaming). */
  onError: (error: {
    code: string;
    message: string;
    retryable: boolean;
    keyStatusUpdates: KeyStatusUpdate[];
  }) => void;
}

export interface StreamTutorChatOptions {
  signal?: AbortSignal;
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Sends a streaming chat request and reads its events.
 *
 * - "response.json()" is not used for the streaming path; reading is via SSE only.
 * - Unified errors before streaming starts arrive as normal JSON and are passed to "onError".
 * - Cancellation via AbortController is not considered an error and does not invoke any handler.
 * - The shape of each event is validated before consumption, and unknown ones are safely ignored.
 */
export async function streamTutorChat(
  payload: TutorChatPayload,
  handlers: TutorStreamHandlers,
  options: StreamTutorChatOptions = {},
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: true }),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortLike(error, options.signal)) {
      return;
    }
    throw new TutorClientError('تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول مرة أخرى.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    // Unified error before streaming starts (normal JSON response).
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new TutorClientError('استجابة غير مفهومة من الخادم.');
    }
    const parsed = parseTutorApiResponse(raw);
    if (!parsed || parsed.success) {
      throw new TutorClientError('استجابة غير صالحة من الخادم.');
    }
    handlers.onError({
      code: parsed.error.code,
      message: parsed.error.message,
      retryable: parsed.error.retryable,
      keyStatusUpdates: parsed.keyStatusUpdates,
    });
    return;
  }

  if (!response.body) {
    throw new TutorClientError('استجابة غير مفهومة من الخادم.');
  }

  const reader = response.body.getReader();
  // Progressive decoding that preserves Arabic and UTF-8 even when characters are split across chunks.
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const event = parseSseBlock(block);
        if (event) {
          if (event.type === 'token') {
            handlers.onToken(event.text);
          } else if (event.type === 'done') {
            handlers.onDone({ usage: event.usage, keyStatusUpdates: event.keyStatusUpdates });
          } else {
            handlers.onError({
              code: event.code,
              message: event.message,
              retryable: event.retryable,
              keyStatusUpdates: event.keyStatusUpdates,
            });
          }
        }
        separator = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (isAbortLike(error, options.signal)) {
      return;
    }
    throw new TutorClientError('انقطع الاتصال أثناء استقبال الرد.');
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Lock is already released.
    }
  }
}

/** Creates a new session for a subject, with response shape validation. */
export async function postCreateSession(subjectId: string): Promise<CreateSessionResult | null> {
  let response: Response;
  try {
    response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId }),
    });
  } catch {
    return null;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return null;
  }

  if (!isRecord(raw) || raw.success !== true || !isRecord(raw.data)) {
    return null;
  }
  const data = raw.data;
  if (
    typeof data.sessionId !== 'string' ||
    typeof data.subjectId !== 'string' ||
    typeof data.subjectName !== 'string'
  ) {
    return null;
  }
  return {
    sessionId: data.sessionId,
    subjectId: data.subjectId,
    subjectName: data.subjectName,
  };
}
