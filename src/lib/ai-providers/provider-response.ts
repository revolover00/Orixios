/**
 * شكل الاستجابة الموحّدة القادمة من أي مزود ذكاء اصطناعي.
 */

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ProviderGenerateResponse {
  text: string;
  /** التفكير/الاستدلال إن كان المزود يدعمه. */
  reasoning?: string;
  usage?: ProviderUsage;
}

/**
 * جزء واحد من بث المزود:
 * - أجزاء نصية تدريجية (text).
 * - جزء ختامي يحمل سبب الانتهاء والاستخدام إن توفرا.
 */
export interface ProviderStreamChunk {
  text?: string;
  finishReason?: string;
  usage?: ProviderUsage;
}
