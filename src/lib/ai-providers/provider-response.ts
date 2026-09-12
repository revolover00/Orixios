/**
 * The unified response format coming from any AI provider.
 */

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ProviderGenerateResponse {
  text: string;
  /** Reasoning/inference if the provider supports it. */
  reasoning?: string;
  usage?: ProviderUsage;
}

/**
 * One part of the provider's stream:
 * - Progressive text parts (text).
 * - A final part carrying the completion reason and usage if available.
 */
export interface ProviderStreamChunk {
  text?: string;
  finishReason?: string;
  usage?: ProviderUsage;
}
