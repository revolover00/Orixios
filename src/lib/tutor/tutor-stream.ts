/**
 * Chat streaming protocol (SSE).
 *
 * Fixed event format between server and client:
 *
 *   event: token
 *   data: {"text":"..."}
 *
 *   event: done
 *   data: {"usage":{"inputTokens":..,"outputTokens":..},"keyStatusUpdates":[..]}
 *
 *   event: error
 *   data: {"code":"...","message":"...","retryable":true|false,"keyStatusUpdates":[..]}
 *
 * Rules:
 * - Keys, system prompt, or grounded context are not sent in any event.
 * - Unknown or invalid events are safely ignored by the client.
 */

import { API_KEY_STATUSES, type KeyStatusUpdate } from '@/types/providers';
import type { ProviderUsage } from '@/lib/ai-providers/provider-response';

export interface TutorTokenEvent {
  type: 'token';
  text: string;
}

export interface TutorDoneEvent {
  type: 'done';
  usage?: ProviderUsage;
  keyStatusUpdates: KeyStatusUpdate[];
}

export interface TutorStreamErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
  keyStatusUpdates: KeyStatusUpdate[];
}

export type TutorStreamEvent = TutorTokenEvent | TutorDoneEvent | TutorStreamErrorEvent;

/** Encodes a single event into an SSE block. */
export function encodeSseEvent(event: TutorStreamEvent): string {
  let payload: Record<string, unknown>;
  switch (event.type) {
    case 'token':
      payload = { text: event.text };
      break;
    case 'done':
      payload = { usage: event.usage ?? {}, keyStatusUpdates: event.keyStatusUpdates };
      break;
    case 'error':
      payload = {
        code: event.code,
        message: event.message,
        retryable: event.retryable,
        keyStatusUpdates: event.keyStatusUpdates,
      };
      break;
  }
  return `event: ${event.type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Strict validation of key status updates before consumption. */
export function parseKeyStatusUpdatesSafe(value: unknown): KeyStatusUpdate[] {
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

function parseUsageSafe(value: unknown): ProviderUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const usage: ProviderUsage = {};
  if (typeof value.inputTokens === 'number' && Number.isFinite(value.inputTokens)) {
    usage.inputTokens = value.inputTokens;
  }
  if (typeof value.outputTokens === 'number' && Number.isFinite(value.outputTokens)) {
    usage.outputTokens = value.outputTokens;
  }
  return usage.inputTokens !== undefined || usage.outputTokens !== undefined ? usage : undefined;
}

/**
 * Parses a single SSE block into a validated event.
 * Returns "null" for any unknown event or invalid data (safely ignored).
 */
export function parseSseBlock(block: string): TutorStreamEvent | null {
  let eventName = '';
  let dataRaw = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataRaw += line.slice(5).trim();
    }
  }
  if (eventName.length === 0 || dataRaw.length === 0) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }

  if (eventName === 'token') {
    if (typeof data.text !== 'string') {
      return null;
    }
    return { type: 'token', text: data.text };
  }

  if (eventName === 'done') {
    return {
      type: 'done',
      usage: parseUsageSafe(data.usage),
      keyStatusUpdates: parseKeyStatusUpdatesSafe(data.keyStatusUpdates),
    };
  }

  if (eventName === 'error') {
    if (typeof data.code !== 'string' || typeof data.message !== 'string') {
      return null;
    }
    return {
      type: 'error',
      code: data.code,
      message: data.message,
      retryable: data.retryable === true,
      keyStatusUpdates: parseKeyStatusUpdatesSafe(data.keyStatusUpdates),
    };
  }

  // Unknown event: safely ignored.
  return null;
}
