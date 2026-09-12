/**
 * خدمة الشات: منطق العمل الأساسي، مفصولًا عن طبقة الـ HTTP.
 *
 * المسار الكامل (غير التدفقي): "processTutorRequest".
 * مسار البث: "startTutorStream" — يجري كل التحقق قبل بدء البث،
 * ثم يرجع أحداثًا (token / done / error) عبر بروتوكول البث الموحد.
 *
 * ترتيب المعالجة المشترك:
 * 1. التحقق من الجلسة.
 * 2. التحقق من تطابق المادة (قفل المادة).
 * 3. تحميل المادة من الكتالوج.
 * 4. تحميل السياق الموثوق.
 * 5. بناء system prompt.
 * 6. اختيار المفتاح والمزود.
 * 7. إرسال الرسائل (كاملًا أو بثًا).
 * 8. تصنيف الأخطاء.
 * 9. تحديث حالة المفتاح عند الحاجة.
 * 10. إرجاع استجابة آمنة.
 */

import { classifyProviderError, isAbortError, ProviderError } from '@/lib/ai-providers/errors';
import {
  getProviderClient,
  type ProviderClient,
} from '@/lib/ai-providers/provider-client';
import type { ProviderStreamChunk } from '@/lib/ai-providers/provider-response';
import { getProviderConfig } from '@/lib/ai-providers/provider-config';
import { MAX_KEY_ATTEMPTS } from '@/lib/ai-providers/provider-selector';
import { getSubjectById } from '@/lib/sessions/subject-catalog';
import { SessionError } from '@/lib/sessions/session-errors';
import {
  sessionStore as defaultSessionStore,
  type SessionStore,
} from '@/lib/sessions/session-store';
import { buildTutorSystemPrompt } from '@/lib/tutor-skills/tutor-system-prompt';
import type { KeyStatusUpdate, ProviderName, UserApiKey, UserKeyCredential } from '@/types/providers';
import type { SubjectId } from '@/types/sessions';
import type { ChatMessage } from '@/types/tutor';
import { resolveGroundedContext } from '@/lib/grounded-knowledge/knowledge-loader';
import {
  providerErrorToTutorError,
  safeTutorError,
  unknownErrorToTutorError,
} from './tutor-error-handler';
import type { TutorApiResponse } from './tutor-response';
import { buildErrorResponse } from './tutor-response';
import type { TutorStreamEvent } from './tutor-stream';

export interface TutorServiceInput {
  sessionId: string;
  subjectId: SubjectId;
  messages: ChatMessage[];
  currentTopic?: string;
  keys: UserKeyCredential[];
}

/** اعتماديات قابلة للحقن للاختبار دون أي استدعاء خارجي. */
export interface TutorServiceDeps {
  createClient?: (provider: ProviderName) => ProviderClient;
  /** يمكن استبدال مخزن الجلسات في الاختبار أو عند الانتقال إلى Supabase. */
  sessionStore?: SessionStore;
  /** إشارة إلغاء الطلب (تُمرر إلى المزود). */
  signal?: AbortSignal;
}

/* ------------------------- السياق المشترك المحضَّر ------------------------ */

interface PreparedContext {
  systemPrompt: string;
}

type PrepareResult =
  | { ok: true; context: PreparedContext }
  | { ok: false; response: TutorApiResponse };

/**
 * كل التحقق الذي يجب أن يسبق أي استدعاء مزود (سواء كاملًا أو بثًا):
 * الجلسة، قفل المادة، الكتالوج، السياق الموثوق، وبناء الـ prompt.
 */
function prepareTutorContext(input: TutorServiceInput, sessions: SessionStore): PrepareResult {
  const session = sessions.getSession(input.sessionId);
  if (!session) {
    return { ok: false, response: buildErrorResponse(safeTutorError('SESSION_NOT_FOUND')) };
  }

  try {
    sessions.assertSessionSubject({
      sessionId: input.sessionId,
      subjectId: input.subjectId,
    });
  } catch (error) {
    if (error instanceof SessionError) {
      const body =
        error.code === 'SUBJECT_MISMATCH'
          ? safeTutorError(
              'SUBJECT_LOCKED',
              `لا يمكن تغيير المادة داخل نفس الجلسة. هذه الجلسة مخصصة لمادة ${session.subjectName}، وتغيير المادة يتطلب بدء جلسة جديدة.`,
            )
          : safeTutorError(
              error.code === 'SESSION_ENDED' ? 'SESSION_ENDED' : 'VALIDATION_ERROR',
            );
      return { ok: false, response: buildErrorResponse(body) };
    }
    return { ok: false, response: buildErrorResponse(unknownErrorToTutorError()) };
  }

  const subject = getSubjectById(session.subjectId);
  if (!subject) {
    return { ok: false, response: buildErrorResponse(safeTutorError('INVALID_SUBJECT')) };
  }

  const grounded = resolveGroundedContext({
    subjectId: session.subjectId,
    topic: input.currentTopic,
  });

  const systemPrompt = buildTutorSystemPrompt({
    subjectId: session.subjectId,
    subjectName: subject.nameAr,
    currentTopic: input.currentTopic,
    groundedContext: grounded.context,
    hasAvailableSource: grounded.hasAvailableSource,
    sessionId: session.id,
  });

  return { ok: true, context: { systemPrompt } };
}

/** العميل يرسل المفاتيح الصالحة مرتبة بالأولوية؛ الأول هو الافتراضي. */
function toUserApiKey(credential: UserKeyCredential, index: number): UserApiKey {
  return {
    ...credential,
    label: 'مفتاح المستخدم',
    status: 'active',
    isDefault: index === 0,
    createdAt: new Date(0).toISOString(),
  };
}

/** ترتيب المفاتيح النشطة: الافتراضي أولًا ثم حسب تاريخ الإنشاء. */
function prioritizeInputKeys(keys: UserApiKey[]): UserApiKey[] {
  const active = keys.filter((key) => key.status === 'active');
  const sorted = [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const defaultIndex = sorted.findIndex((key) => key.isDefault);
  if (defaultIndex <= 0) {
    return sorted;
  }
  const defaultKey = sorted.splice(defaultIndex, 1)[0];
  return [defaultKey, ...sorted];
}

/* ----------------------------- المسار الكامل ------------------------------ */

export async function processTutorRequest(
  input: TutorServiceInput,
  deps: TutorServiceDeps = {},
): Promise<TutorApiResponse> {
  const createClient = deps.createClient ?? getProviderClient;
  const sessions = deps.sessionStore ?? defaultSessionStore;

  const prepared = prepareTutorContext(input, sessions);
  if (!prepared.ok) {
    return prepared.response;
  }

  const userKeys = input.keys.map(toUserApiKey);
  const orderedKeys = prioritizeInputKeys(userKeys).filter(
    (key) => getProviderConfig(key.provider).enabled,
  );

  if (userKeys.length === 0) {
    return buildErrorResponse(safeTutorError('NO_API_KEY'));
  }
  if (orderedKeys.length === 0) {
    const hasActive = userKeys.some((key) => key.status === 'active');
    return buildErrorResponse(safeTutorError(hasActive ? 'PROVIDER_UNKNOWN' : 'ALL_KEYS_EXHAUSTED'));
  }

  // حلقة محدودة: محاولة واحدة لكل مفتاح، ولا حلقات مفتوحة.
  const attempted = new Set<string>();
  const keyStatusUpdates: KeyStatusUpdate[] = [];

  for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
    const key = orderedKeys.find((candidate) => !attempted.has(candidate.id));
    if (!key) {
      break;
    }
    attempted.add(key.id);

    try {
      const client = createClient(key.provider);
      const result = await client.generateResponse({
        systemPrompt: prepared.context.systemPrompt,
        messages: input.messages,
        apiKey: key.apiKey,
      });
      return {
        success: true,
        data: {
          message: { role: 'assistant', content: result.text },
          reasoning: result.reasoning,
          usage: result.usage,
        },
        keyStatusUpdates,
      };
    } catch (error) {
      if (isAbortError(error)) {
        // إلغاء المستخدم ليس خطأ دائمًا ولا يغيّر حالة المفتاح.
        return buildErrorResponse(
          safeTutorError('NETWORK_ERROR', 'أُلغي الطلب.'),
          keyStatusUpdates,
        );
      }
      const providerError =
        error instanceof ProviderError ? error : classifyProviderError(error, key.provider);
      if (providerError.code === 'QUOTA_EXCEEDED') {
        keyStatusUpdates.push({ keyId: key.id, status: 'exhausted' });
        continue;
      }
      if (providerError.code === 'INVALID_API_KEY') {
        keyStatusUpdates.push({ keyId: key.id, status: 'invalid' });
        return buildErrorResponse(providerErrorToTutorError(providerError), keyStatusUpdates);
      }
      return buildErrorResponse(providerErrorToTutorError(providerError), keyStatusUpdates);
    }
  }

  return buildErrorResponse(safeTutorError('ALL_KEYS_EXHAUSTED'), keyStatusUpdates);
}

/* ------------------------------- مسار البث -------------------------------- */

export type TutorStreamOutcome =
  /** فشل معروف قبل بدء البث: يُعاد كرد JSON عادي موحد. */
  | { ok: false; response: TutorApiResponse }
  /** نجح التأسيس: أحداث البث جاهزة (token ثم done، أو error أثناء البث). */
  | { ok: true; events: AsyncIterable<TutorStreamEvent> };

interface EstablishedStream {
  iterator: AsyncIterator<ProviderStreamChunk>;
  firstChunk: ProviderStreamChunk | undefined;
  providerName: ProviderName;
  keyId: string;
}

/**
 * بدء بث رد المدرّس.
 *
 * كل التحقق واختيار المفتاح وتجربة أول جزء يحدث قبل إرجاع الأحداث؛
 * لذلك أخطاء مثل "مفتاح غير صالح" أو "لا مفاتيح" تُعاد كفشل قبل البث،
 * بينما الأخطاء الواقعة بعد وصول نص تُسلَّم كحدث "error" داخل البث.
 */
export async function startTutorStream(
  input: TutorServiceInput,
  deps: TutorServiceDeps = {},
): Promise<TutorStreamOutcome> {
  const createClient = deps.createClient ?? getProviderClient;
  const sessions = deps.sessionStore ?? defaultSessionStore;
  const signal = deps.signal;

  const prepared = prepareTutorContext(input, sessions);
  if (!prepared.ok) {
    return { ok: false, response: prepared.response };
  }

  const userKeys = input.keys.map(toUserApiKey);
  if (userKeys.length === 0) {
    return { ok: false, response: buildErrorResponse(safeTutorError('NO_API_KEY')) };
  }
  const orderedKeys = prioritizeInputKeys(userKeys).filter(
    (key) => getProviderConfig(key.provider).enabled,
  );
  if (orderedKeys.length === 0) {
    const hasActive = userKeys.some((key) => key.status === 'active');
    return {
      ok: false,
      response: buildErrorResponse(safeTutorError(hasActive ? 'PROVIDER_UNKNOWN' : 'ALL_KEYS_EXHAUSTED')),
    };
  }

  const attempted = new Set<string>();
  const preStreamUpdates: KeyStatusUpdate[] = [];
  let established: EstablishedStream | null = null;

  for (let attempt = 0; attempt < MAX_KEY_ATTEMPTS; attempt += 1) {
    const key = orderedKeys.find((candidate) => !attempted.has(candidate.id));
    if (!key) {
      break;
    }
    attempted.add(key.id);

    try {
      const client = createClient(key.provider);

      let iterator: AsyncIterator<ProviderStreamChunk>;
      if (client.streamResponse) {
        const iterable = await client.streamResponse({
          systemPrompt: prepared.context.systemPrompt,
          messages: input.messages,
          apiKey: key.apiKey,
          signal,
        });
        iterator = iterable[Symbol.asyncIterator]();
      } else {
        // احتياط غير تدفقي: المزود لا يدعم البث؛ نغلّف الرد الكامل كحدث واحد.
        const result = await client.generateResponse({
          systemPrompt: prepared.context.systemPrompt,
          messages: input.messages,
          apiKey: key.apiKey,
        });
        const singleChunk: ProviderStreamChunk = {
          text: result.text,
          finishReason: 'stop',
          usage: result.usage,
        };
        iterator = (async function* () {
          yield singleChunk;
        })()[Symbol.asyncIterator]();
      }

      // اختبار المفتاح بأول جزء قبل الالتزام بالبث.
      const first = await iterator.next();
      established = {
        iterator,
        firstChunk: first.done ? undefined : first.value,
        providerName: key.provider,
        keyId: key.id,
      };
      break;
    } catch (error) {
      if (isAbortError(error)) {
        // إلغاء المستخدم قبل البث: لا خطأ دائمًا ولا تغيير لحالة المفتاح.
        return {
          ok: false,
          response: buildErrorResponse(safeTutorError('NETWORK_ERROR', 'أُلغي الطلب.')),
        };
      }
      const providerError =
        error instanceof ProviderError ? error : classifyProviderError(error, key.provider);
      if (providerError.code === 'QUOTA_EXCEEDED') {
        preStreamUpdates.push({ keyId: key.id, status: 'exhausted' });
        continue; // جرّب مفتاحًا نشطًا آخر مرة واحدة.
      }
      if (providerError.code === 'INVALID_API_KEY') {
        preStreamUpdates.push({ keyId: key.id, status: 'invalid' });
        return {
          ok: false,
          response: buildErrorResponse(providerErrorToTutorError(providerError), preStreamUpdates),
        };
      }
      return {
        ok: false,
        response: buildErrorResponse(providerErrorToTutorError(providerError), preStreamUpdates),
      };
    }
  }

  if (!established) {
    return {
      ok: false,
      response: buildErrorResponse(safeTutorError('ALL_KEYS_EXHAUSTED'), preStreamUpdates),
    };
  }

  const stream = established;
  const updates = preStreamUpdates;

  async function* events(): AsyncGenerator<TutorStreamEvent> {
    let usage: ProviderStreamChunk['usage'];
    try {
      if (stream.firstChunk) {
        if (stream.firstChunk.text) {
          yield { type: 'token', text: stream.firstChunk.text };
        }
        if (stream.firstChunk.usage) {
          usage = stream.firstChunk.usage;
        }
      }
      for (;;) {
        const next = await stream.iterator.next();
        if (next.done) {
          break;
        }
        const chunk = next.value;
        if (chunk.text) {
          yield { type: 'token', text: chunk.text };
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }
      yield { type: 'done', usage, keyStatusUpdates: updates };
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        // إلغاء العميل: نغلق بصمت دون خطأ أو تغيير لحالة المفتاح.
        return;
      }
      const providerError =
        error instanceof ProviderError
          ? error
          : classifyProviderError(error, stream.providerName);
      const midStreamUpdates = [...updates];
      if (providerError.code === 'QUOTA_EXCEEDED') {
        midStreamUpdates.push({ keyId: stream.keyId, status: 'exhausted' });
      } else if (providerError.code === 'INVALID_API_KEY') {
        midStreamUpdates.push({ keyId: stream.keyId, status: 'invalid' });
      }
      const body = providerErrorToTutorError(providerError);
      yield {
        type: 'error',
        code: body.code,
        message: body.message,
        retryable: body.retryable,
        keyStatusUpdates: midStreamUpdates,
      };
    } finally {
      try {
        await stream.iterator.return?.();
      } catch {
        // إغلاق المورد الثانوي ليس خطأ يستحق التصعيد.
      }
    }
  }

  return { ok: true, events: events() };
}
