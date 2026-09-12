/**
 * Active key selection + error rotation and key switching.
 *
 * Strict separation: selection (getActiveModel) is a pure decision that sends no requests,
 * and sending is done by injecting a callback function into the rotation cycle (runWithKeyRotation).
 * No part of this logic lives inside React components.
 *
 * Selection rules:
 * 1. Keys with "invalid" or "exhausted" status are not selected.
 * 2. The active default key first, otherwise the first active key.
 * 3. When a provider is specified, search only within it.
 * 4. No keys → NO_API_KEY; environment key is only used if
 *    DEV_TESTING_MODE=true combined with an explicit option to accept the fallback.
 * 5. Existing keys are all exhausted/invalid → ALL_KEYS_EXHAUSTED.
 * 6. Active keys for an inactive provider → PROVIDER_NOT_CONFIGURED.
 *
 * Rotation rules:
 * - QUOTA_EXCEEDED: mark key as "exhausted" and try another active key,
 *   only once per key (via Set and a maximum attempt limit) — no infinite loops.
 * - INVALID_API_KEY: mark key as "invalid" and stop immediately without automatic rotation.
 * - NETWORK_ERROR: key status does not change, and a temporary error is returned.
 */

import type { ApiKeyStatus, KeyStatusUpdate, UserApiKey } from '@/types/providers';
import {
  getDevTestingFallbackKey,
  getProviderConfig,
  isDevTestingMode,
} from './provider-config';
import { ProviderError, classifyProviderError } from './errors';
import type {
  GetActiveModelOptions,
  KeyRotationOptions,
  KeyRotationOutcome,
  ProviderSelectionResult,
} from './types';
import { listApiKeys } from './user-keys-storage';

/** Maximum number of keys to try in a single request. */
export const MAX_KEY_ATTEMPTS = 5;

/**
 * Attempts to use the development environment key, and only succeeds if:
 * explicit option + testing mode active + non-empty environment key + provider compatibility.
 * Otherwise: no silent fallback whatsoever.
 */
function tryDevEnvironmentFallback(
  options: GetActiveModelOptions | undefined,
): ProviderSelectionResult | null {
  if (!options?.allowDevEnvironmentFallback) {
    return null;
  }
  if (!isDevTestingMode()) {
    return null;
  }
  const fallbackKey = getDevTestingFallbackKey();
  if (!fallbackKey) {
    return null;
  }
  if (options.preferredProvider && options.preferredProvider !== fallbackKey.provider) {
    return null;
  }
  return { key: fallbackKey, provider: getProviderConfig(fallbackKey.provider) };
}

/**
 * Selects the most suitable active key with its provider settings.
 *
 * Throws ProviderError with codes:
 * - NO_API_KEY when no keys exist (and development fallback conditions were not met).
 * - ALL_KEYS_EXHAUSTED when keys exist but all are invalid/exhausted.
 * - PROVIDER_NOT_CONFIGURED when active keys are for an inactive provider.
 *
 * No key status is changed within this function; it is read and selection only.
 */
export function getActiveModel(options?: GetActiveModelOptions): ProviderSelectionResult {
  const sourceKeys = options?.keys ?? listApiKeys();
  const scopedKeys = options?.preferredProvider
    ? sourceKeys.filter((key) => key.provider === options.preferredProvider)
    : sourceKeys;

  if (scopedKeys.length === 0) {
    const fallback = tryDevEnvironmentFallback(options);
    if (fallback) {
      return fallback;
    }
    throw new ProviderError('NO_API_KEY');
  }

  const activeKeys = scopedKeys.filter((key) => key.status === 'active');
  if (activeKeys.length === 0) {
    // Keys exist but all are exhausted or invalid.
    throw new ProviderError('ALL_KEYS_EXHAUSTED');
  }

  const configuredKeys = activeKeys.filter(
    (key) => getProviderConfig(key.provider).enabled === true,
  );
  if (configuredKeys.length === 0) {
    // Active keys but their provider is an inactive placeholder.
    throw new ProviderError('PROVIDER_NOT_CONFIGURED', {
      provider: activeKeys[0]?.provider,
    });
  }

  const selectedKey = configuredKeys.find((key) => key.isDefault) ?? configuredKeys[0];
  return { key: selectedKey, provider: getProviderConfig(selectedKey.provider) };
}

/**
 * Error rotation and key switching.
 *
 * - Selects and executes, and collects key status updates to return to the caller
 *   (e.g., the server returns them to the client to apply in storage).
 * - The number of attempts is limited, and Set prevents trying the same key twice.
 * - Returned errors are general and safe; key values or raw texts are not exposed.
 */
export async function runWithKeyRotation(options: KeyRotationOptions): Promise<KeyRotationOutcome> {
  const { invoke, preferredProvider, onKeyStatusChange } = options;
  const maxAttempts = Math.max(
    1,
    Math.min(options.maxAttempts ?? MAX_KEY_ATTEMPTS, MAX_KEY_ATTEMPTS),
  );

  let workingKeys: UserApiKey[] = [...options.keys];
  const attemptedKeyIds = new Set<string>();
  const keyStatusUpdates: KeyStatusUpdate[] = [];

  const markKeyStatus = (keyId: string, status: ApiKeyStatus) => {
    keyStatusUpdates.push({ keyId, status });
    workingKeys = workingKeys.map((key) => (key.id === keyId ? { ...key, status } : key));
    if (onKeyStatusChange) {
      onKeyStatusChange(keyId, status);
    }
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let selection: ProviderSelectionResult;
    try {
      selection = getActiveModel({ keys: workingKeys, preferredProvider });
    } catch (error) {
      const providerError =
        error instanceof ProviderError ? error : new ProviderError('ALL_KEYS_EXHAUSTED');
      return { ok: false, error: providerError, keyStatusUpdates };
    }

    // Additional protection against repeatedly trying the same key (Set + attempt limit).
    if (attemptedKeyIds.has(selection.key.id)) {
      return {
        ok: false,
        error: new ProviderError('ALL_KEYS_EXHAUSTED'),
        keyStatusUpdates,
      };
    }
    attemptedKeyIds.add(selection.key.id);

    try {
      const text = await invoke(selection.key);
      return {
        ok: true,
        text,
        usedKeyId: selection.key.id,
        provider: selection.provider.name,
        keyStatusUpdates,
      };
    } catch (error) {
      const providerError = classifyProviderError(error, selection.key.provider);
      providerError.keyId = selection.key.id;

      if (providerError.code === 'QUOTA_EXCEEDED') {
        // Mark the key as exhausted and switch once to another active key.
        markKeyStatus(selection.key.id, 'exhausted');
        continue;
      }

      if (providerError.code === 'INVALID_API_KEY') {
        // Mark the key as invalid and stop immediately: no automatic rotation.
        markKeyStatus(selection.key.id, 'invalid');
        return { ok: false, error: providerError, keyStatusUpdates };
      }

      // NETWORK_ERROR or any other error: no change to key status, temporary error.
      return { ok: false, error: providerError, keyStatusUpdates };
    }
  }

  // Attempt limit consumed (all tried keys are exhausted).
  return {
    ok: false,
    error: new ProviderError('ALL_KEYS_EXHAUSTED'),
    keyStatusUpdates,
  };
}
