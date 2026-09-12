/**
 * AI provider types and user keys.
 */

/**
 * Supported providers.
 * - "openrouter" and "github-models" are inactive placeholders for now.
 * - "mock" is a local development simulation tool and not an external AI provider;
 *   its presence allows testing chat without real keys, and it can be disabled with a single flag.
 */
export const PROVIDER_NAMES = ['gemini', 'openrouter', 'github-models', 'mock'] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const API_KEY_STATUSES = ['active', 'exhausted', 'invalid'] as const;

export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

/**
 * User-specific API key.
 * Note: At this stage, it is temporarily stored in localStorage (see
 * lib/ai-providers/user-keys-storage.ts). Later, it will be replaced with encrypted storage via Supabase.
 */
export interface UserApiKey {
  id: string;
  provider: ProviderName;
  label: string;
  apiKey: string;
  status: ApiKeyStatus;
  isDefault: boolean;
  /** Creation date in ISO format. */
  createdAt: string;
}

/**
 * A secure version of the key suitable for display in the user interface.
 * Never contains the raw key value.
 */
export interface PublicUserApiKey {
  id: string;
  provider: ProviderName;
  label: string;
  status: ApiKeyStatus;
  isDefault: boolean;
  createdAt: string;
  /** Masked preview like: ••••1234 */
  keyPreview: string;
}

/** Key status update resulting from an actual call attempt (e.g., quota exhaustion). */
export interface KeyStatusUpdate {
  keyId: string;
  status: ApiKeyStatus;
}

/**
 * Credentials sent with the chat request.
 * Sending the key from the client is necessary only in the Mock phase because storage is in localStorage,
 * and will later be replaced with secure fetching from the server side via Supabase.
 */
export interface UserKeyCredential {
  id: string;
  provider: ProviderName;
  apiKey: string;
}
