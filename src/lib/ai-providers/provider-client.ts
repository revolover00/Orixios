/**
 * Unified provider clients.
 *
 * - No React component should make direct calls to a provider; all calls pass through here.
 * - Currently implemented: actual Gemini, and a local development simulation provider.
 * - OpenRouter and GitHub Models are placeholders that reject execution with a clear error.
 * - The design allows for adding Streaming later (adding a new function to the interface
 *   without breaking the current generateResponse).
 */

import { createGoogle } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import type { ProviderName } from '@/types/providers';
import { GROUNDED_SOURCES_END, GROUNDED_SOURCES_START } from '@/lib/grounded-knowledge/types';
import { ProviderError } from './errors';
import { getProviderConfig } from './provider-config';
import type { ProviderGenerateRequest, ProviderStreamRequest } from './provider-request';
import type { ProviderGenerateResponse, ProviderStreamChunk } from './provider-response';

/**
 * Unified provider client:
 * - "generateResponse" for full generation — mandatory for every provider.
 * - "streamResponse" for progressive streaming — optional; providers that don't support it use the service layer's
 *   full generation path as a safe fallback.
 */
export interface ProviderClient {
  readonly providerName: ProviderName;
  generateResponse(input: ProviderGenerateRequest): Promise<ProviderGenerateResponse>;
  streamResponse?(input: ProviderStreamRequest): Promise<AsyncIterable<ProviderStreamChunk>>;
}

/* ------------------------------ Gemini ---------------------------------- */

function createGeminiClient(): ProviderClient {
  return {
    providerName: 'gemini',
    async generateResponse({ systemPrompt, messages, apiKey, model }) {
      // The provider is created explicitly with the user's key, and does not rely on any environment variable.
      const google = createGoogle({ apiKey });
      const modelId = model ?? getProviderConfig('gemini').defaultModel ?? 'gemini-2.5-flash';

      const result = await generateText({
        model: google(modelId),
        system: systemPrompt,
        messages,
      });

      // Inference comes in parts; we combine only the text parts.
      const reasoningText = result.reasoning
        .map((part) => (part.type === 'reasoning' ? part.text : ''))
        .filter((part) => part.length > 0)
        .join('\n');

      return {
        text: result.text,
        reasoning: reasoningText.length > 0 ? reasoningText : undefined,
        usage: {
          inputTokens: result.usage.inputTokens ?? undefined,
          outputTokens: result.usage.outputTokens ?? undefined,
        },
      };
    },
    async streamResponse({ systemPrompt, messages, apiKey, model, signal }) {
      // The provider is created explicitly with the user's key, and does not rely on any environment variable.
      const google = createGoogle({ apiKey });
      const modelId = model ?? getProviderConfig('gemini').defaultModel ?? 'gemini-2.5-flash';

      // The cancellation signal is passed directly so that model consumption stops when the client cancels.
      const result = streamText({
        model: google(modelId),
        system: systemPrompt,
        messages,
        abortSignal: signal,
      });

      async function* parts(): AsyncGenerator<ProviderStreamChunk> {
        for await (const piece of result.textStream) {
          if (piece.length > 0) {
            yield { text: piece };
          }
        }
        const [usage, finishReason] = await Promise.all([result.usage, result.finishReason]);
        yield {
          finishReason,
          usage: {
            inputTokens: usage.inputTokens ?? undefined,
            outputTokens: usage.outputTokens ?? undefined,
          },
        };
      }

      return parts();
    },
  };
}

/* ------------------------- Development Simulation Provider ------------------------ */

/** Reads source topics from the system prompt (between wrapping tags). */
function extractTopicsFromSystemPrompt(systemPrompt: string): string[] {
  const start = systemPrompt.indexOf(GROUNDED_SOURCES_START);
  const end = systemPrompt.indexOf(GROUNDED_SOURCES_END);
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }
  const section = systemPrompt.slice(start + GROUNDED_SOURCES_START.length, end);
  const topics: string[] = [];
  const pattern = /(?:^|\n)\s*Topic: (.+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section)) !== null) {
    const topic = match[1]?.trim();
    if (topic) {
      topics.push(topic);
    }
  }
  return topics;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!.،,؛:«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeArabic(value: string): string[] {
  return normalizeForMatch(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

const MOCK_SIGNATURE =
  '— ملاحظة: هذه إجابة مولّدة من مزود المحاكاة التطويري لأغراض الاختبار، وليست ناتجة عن نموذج ذكاء اصطناعي فعلي.';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Local simulation: builds a Socratic tutor response based on the topics embedded
 * in the system prompt only, without any external connection.
 */
/** Builds the simulation provider's response based on the topics embedded in the prompt only. */
function buildMockReply(systemPrompt: string, question: string): string {
  const topics = extractTopicsFromSystemPrompt(systemPrompt);

  if (topics.length === 0) {
    return [
      'لا تتوفر حاليًا مصادر موثوقة لهذه الجلسة، لذلك لا أستطيع تقديم شرح معتمد.',
      'يمكنك تجربة موضوع آخر تتوفر له مصادر داخل نفس المادة.',
      MOCK_SIGNATURE,
    ].join('\n');
  }

  const questionTokens = tokenizeArabic(question);
  const matchedTopic = topics.find((topic) => {
    const topicTokens = tokenizeArabic(topic);
    return questionTokens.some((token) => topicTokens.includes(token));
  });

  if (!matchedTopic) {
    const topicsList = topics.map((topic) => `«${topic}»`).join('، ');
    return [
      'هذا الجزء غير موجود في المصادر الموثوقة المتاحة لهذه الجلسة، لذلك لن أخمن إجابة من عندي.',
      `الموضوعات المتاحة حاليًا في مصادر هذه الجلسة: ${topicsList}.`,
      'هل تريد أن نبدأ بأحد هذه الموضوعات؟',
      MOCK_SIGNATURE,
    ].join('\n');
  }

  return [
    `سؤالك يقع ضمن موضوع «${matchedTopic}» الموجود في مصادر هذه الجلسة.`,
    'لن أعطيك الحل كاملًا دفعة واحدة؛ سنمشي خطوة بخطوة كما يفعل المدرس الجيد.',
    'ابدأ أولًا بتحديد المطلوب في المسألة، ثم عد إلى خطوات المصدر واحدة واحدة.',
    'سؤالي التوجيهي لك: ما أول خطوة تعتقد أن علينا القيام بها قبل البدء بالحل؟',
    MOCK_SIGNATURE,
  ].join('\n');
}

function createMockClient(): ProviderClient {
  return {
    providerName: 'mock',
    async generateResponse({ systemPrompt, messages }) {
      await sleep(450); // Simulate response time
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
      return { text: buildMockReply(systemPrompt, lastUserMessage?.content ?? '') };
    },
    async streamResponse({ systemPrompt, messages, signal }) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
      const reply = buildMockReply(systemPrompt, lastUserMessage?.content ?? '');
      // Splitting preserves spaces so that the text arrives intact when assembled.
      const pieces = reply.split(/(\s+)/).filter((piece) => piece.length > 0);

      async function* parts(): AsyncGenerator<ProviderStreamChunk> {
        for (const piece of pieces) {
          if (signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
          }
          await sleep(12);
          yield { text: piece };
        }
        yield { finishReason: 'stop', usage: { outputTokens: pieces.length } };
      }

      return parts();
    },
  };
}

/* ------------------------------ Selection --------------------------------- */

/**
 * Returns the appropriate provider client. Inactive placeholders
 * immediately reject execution with a clear error instead of any silent behavior.
 */
export function getProviderClient(provider: ProviderName): ProviderClient {
  if (provider === 'gemini') {
    return createGeminiClient();
  }
  if (provider === 'mock') {
    return createMockClient();
  }
  // openrouter and github-models: unimplemented placeholders at this stage.
  throw new ProviderError('PROVIDER_NOT_CONFIGURED', { provider });
}
