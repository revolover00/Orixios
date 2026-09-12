/**
 * طبقة العميل للاتصال بواجهة الشات وواجهة الجلسات.
 *
 * قواعد:
 * - كل منطق الطلب هنا، وليس داخل مكوّنات العرض.
 * - يتم التحقق من شكل أي استجابة قبل استخدامها في الواجهة.
 * - لا تُعرض أو تُسجَّل المفاتيح أو الردود الحساسة في أي مكان.
 * - لا تُرسل رسائل "system" أو "developer" أو "tool" من الواجهة أبدًا؛
 *   دورا الرسائل الوحيدان الممكنان من المتصفح هما "user" و"assistant".
 *
 * ملاحظة حول حقل "keys": تُجمَع المفاتيح الصالحة من طبقة التخزين
 * (مرحلة التطوير الحالية) ولا تُشتق من مدخلات المستخدم لكل رسالة،
 * وستنتقل لاحقًا إلى جلب آمن عبر Supabase من جهة الخادم.
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

/** خطأ نقل/استجابة غير صالحة — لا يكشف تفاصيل داخلية. */
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

/** تحقق صارم من تحديثات حالات المفاتيح قبل تمريرها لطبقة التخزين. */
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
 * التحقق الصارم من شكل استجابة /api/tutor قبل استخدامها.
 * ترجع "null" لأي شكل غير متوقع حتى لا تُستهلك بيانات غير موثوقة.
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
      // الأكواد غير المعروفة تمر كما هي وتعالجها الواجهة بمسار عام آمن.
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

/* ------------------------------- مسار البث -------------------------------- */

export interface TutorStreamHandlers {
  /** جزء نص جديد من رد المدرّس. */
  onToken: (text: string) => void;
  /** اكتمل البث بنجاح. */
  onDone: (info: { usage?: TutorUsage; keyStatusUpdates: KeyStatusUpdate[] }) => void;
  /** خطأ موحد (قبل البث أو أثناءه). */
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
 * إرسال طلب شات تدفقي وقراءة أحداثه.
 *
 * - لا يُستخدم "response.json()" لمسار البث؛ القراءة عبر SSE فقط.
 * - الأخطاء الموحدة قبل بدء البث تصل كـ JSON عادي وتُمرر إلى "onError".
 * - الإلغاء عبر AbortController لا يُعتبر خطأ ولا يستدعي أي معالج.
 * - التحقق من شكل كل حدث يتم قبل استهلاكه، وغير المعروف يُتجاهل بأمان.
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
    // خطأ موحد قبل بدء البث (استجابة JSON عادية).
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
  // فك ترميز تدريجي يحافظ على العربية وUTF-8 حتى مع انقسام الحروف بين الـ chunks.
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
      // القفل محرر بالفعل.
    }
  }
}

/** إنشاء جلسة جديدة لمادة، مع التحقق من شكل الاستجابة. */
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
