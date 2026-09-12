/**
 * The unified request format sent to any AI provider.
 * This abstraction separates the chat layer from the details of any specific provider.
 */

export interface ProviderRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderGenerateRequest {
  systemPrompt: string;
  messages: ProviderRequestMessage[];
  /** User's key; not logged and not returned in any response. */
  apiKey: string;
  /** Optional model; if absent, the provider's default model is used. */
  model?: string;
}

/** Streaming request: same as generation request with an optional cancellation signal. */
export interface ProviderStreamRequest extends ProviderGenerateRequest {
  signal?: AbortSignal;
}
