/**
 * AI provider layer types (BYOK).
 *
 * Domain types are defined in "@/types/providers" and re-exported here
 * so that this layer is self-contained for those who import it.
 */

import type {
  ApiKeyStatus,
  KeyStatusUpdate,
  ProviderName,
  UserApiKey,
} from '@/types/providers';
import type { ProviderError } from './errors';

export type {
  ApiKeyStatus,
  KeyStatusUpdate,
  ProviderName,
  PublicUserApiKey,
  UserApiKey,
  UserKeyCredential,
} from '@/types/providers';

export type { ProviderErrorCode } from './errors';

/** Provider configuration as it appears for logs and selection. */
export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  enabled: boolean;
  supportsReasoning: boolean;
}

/** Successful selection result: the selected key + its provider configuration. */
export interface ProviderSelectionResult {
  key: UserApiKey;
  provider: ProviderConfig;
}

/** Options for active key selection. */
export interface GetActiveModelOptions {
  /** Search only within a specific provider. */
  preferredProvider?: ProviderName;
  /**
   * Explicit option allowing the use of the development environment key when user keys are absent.
   * Never honored unless two conditions are met: this option = true and DEV_TESTING_MODE=true.
   */
  allowDevEnvironmentFallback?: boolean;
  /**
   * Inject keys directly (for testing, or for server requests where keys arrive
   * in the request body). If absent, they are read from user storage.
   */
  keys?: readonly UserApiKey[];
}

/** Options for error rotation and key switching. */
export interface KeyRotationOptions {
  keys: readonly UserApiKey[];
  /** Actual execution is separated from selection logic (does not mix selection with sending). */
  invoke: (key: UserApiKey) => Promise<string>;
  preferredProvider?: ProviderName;
  /** Maximum number of keys to try in a single request. */
  maxAttempts?: number;
  /**
   * Optional hook to apply state changes immediately (e.g., local storage in the client).
   * State updates are always collected in the rotation result as well.
   */
  onKeyStatusChange?: (keyId: string, status: ApiKeyStatus) => void;
}

export interface KeyRotationSuccess {
  ok: true;
  text: string;
  usedKeyId: string;
  provider: ProviderName;
  keyStatusUpdates: KeyStatusUpdate[];
}

export interface KeyRotationFailure {
  ok: false;
  error: ProviderError;
  keyStatusUpdates: KeyStatusUpdate[];
}

export type KeyRotationOutcome = KeyRotationSuccess | KeyRotationFailure;
