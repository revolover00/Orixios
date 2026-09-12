/**
 * User key storage (React-independent abstraction layer).
 *
 * ⚠️ Important security warning:
 * - Storing in localStorage is a temporary solution for local development only, and is not considered secure
 *   for production ever (any script on the page can read the keys).
 * - Production keys must be stored with strong encryption via Backend/Supabase Vault,
 *   while maintaining the same signatures for this layer so that callers do not change.
 * - Keys or their values are not printed to the console in any path of this module.
 *
 * Implemented protections:
 * - Operating on the server where localStorage does not exist (safely returning empty lists).
 * - Corrupt JSON inside localStorage (safe disregard).
 * - Old data that does not match the current type (sanitize each entry before accepting it).
 * - Presence of more than one default key (only one default is applied: the first one).
 * - Key without a valid provider or without an apiKey (completely excluded).
 *
 * Snapshots are referentially stable to work with useSyncExternalStore
 * without re-rendering loops.
 */

import {
  API_KEY_STATUSES,
  PROVIDER_NAMES,
  type ApiKeyStatus,
  type KeyStatusUpdate,
  type ProviderName,
  type PublicUserApiKey,
  type UserApiKey,
} from '@/types/providers';

const STORAGE_KEY = 'orixios.tutor.userApiKeys.v1';

/** Event broadcast on any change so that interfaces immediately update the lock status. */
export const API_KEYS_CHANGED_EVENT = 'orixios:api-keys-changed';

export type KeyAccessState = 'READY' | 'NO_API_KEY' | 'ALL_KEYS_EXHAUSTED';

export interface AddApiKeyInput {
  provider: ProviderName;
  label: string;
  apiKey: string;
}

const PROVIDER_NAME_SET: ReadonlySet<string> = new Set(PROVIDER_NAMES);
const KEY_STATUS_SET: ReadonlySet<string> = new Set(API_KEY_STATUSES);
const EMPTY_KEYS: UserApiKey[] = [];
const EMPTY_PUBLIC_KEYS: PublicUserApiKey[] = [];
const MASK_FILL = '••••••••••';

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    // In some modes (e.g., privacy), accessing storage throws an exception.
    return typeof window.localStorage !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
}

/* ------------------------- Stored Data Sanitization ------------------------- */

/**
 * Enforces only one default: the first key with isDefault remains default,
 * and the rest are reset. Handles old or manually edited data.
 */
function enforceSingleDefault(keys: UserApiKey[]): UserApiKey[] {
  let defaultSeen = false;
  return keys.map((key) => {
    if (!key.isDefault) {
      return key;
    }
    if (defaultSeen) {
      return { ...key, isDefault: false };
    }
    defaultSeen = true;
    return key;
  });
}

/**
 * Sanitize a value read from storage:
 * Excludes any entry that is not an object, or lacks a valid id/provider/apiKey,
 * corrects optional fields, then enforces a single default.
 */
export function sanitizeStoredKeys(value: unknown): UserApiKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized: UserApiKey[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;

    const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : '';
    const provider = record.provider;
    const id = typeof record.id === 'string' ? record.id.trim() : '';

    // A key without a known provider, or without an apiKey, or without an id is completely excluded.
    if (
      apiKey.length === 0 ||
      id.length === 0 ||
      typeof provider !== 'string' ||
      !PROVIDER_NAME_SET.has(provider)
    ) {
      continue;
    }

    const status =
      typeof record.status === 'string' && KEY_STATUS_SET.has(record.status)
        ? (record.status as ApiKeyStatus)
        : 'active';

    sanitized.push({
      id,
      provider: provider as ProviderName,
      label: typeof record.label === 'string' ? record.label : '',
      apiKey,
      status,
      isDefault: record.isDefault === true,
      createdAt:
        typeof record.createdAt === 'string' && record.createdAt.length > 0
          ? record.createdAt
          : new Date().toISOString(),
    });
  }

  return enforceSingleDefault(sanitized);
}

/* ---------------------- Stable Snapshot Cache ----------------------- */

let cachedRaw: string | null = null;
let cachedKeys: UserApiKey[] = [];
let cachedPublic: PublicUserApiKey[] = [];
/**
 * "Memory-only" mode: activated when the last write failed, so reads are served
 * from the cache (the user's last intention) until a subsequent write succeeds.
 */
let memoryOnly = false;

/** Updates the cache only if the raw value in storage has changed. */
function refreshCache(): UserApiKey[] {
  if (memoryOnly) {
    // Previous write failed: We keep the cache state as the source of truth
    // instead of reading an old value from storage and showing keys disappearing.
    return cachedKeys;
  }
  let raw = '';
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // Storage access failed: We return the last valid snapshot without breaking the application,
    // and no key values are included in any error path.
    return cachedKeys;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let parsed: unknown = [];
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Corrupt JSON: We safely ignore it as if storage were empty.
        parsed = [];
      }
    }
    cachedKeys = sanitizeStoredKeys(parsed);
    cachedPublic = cachedKeys.map(toPublicApiKey);
  }
  return cachedKeys;
}

function readKeys(): UserApiKey[] {
  if (!isStorageAvailable()) {
    return EMPTY_KEYS;
  }
  return refreshCache();
}

function emitKeysChanged(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(API_KEYS_CHANGED_EVENT));
}

function writeKeys(keys: UserApiKey[]): void {
  if (!isStorageAvailable()) {
    return;
  }
  const normalized = enforceSingleDefault(keys);
  const raw = JSON.stringify(normalized);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    memoryOnly = false;
  } catch {
    // Write failed (e.g., storage full): We keep the state in the cache
    // so the interface doesn't break, safely ignoring the error (no key values in any log).
    memoryOnly = true;
  }
  cachedKeys = normalized;
  cachedPublic = normalized.map(toPublicApiKey);
  emitKeysChanged();
}

/* ------------------------------ Reading ---------------------------------- */

export function listApiKeys(): UserApiKey[] {
  return readKeys();
}

/** Active keys only (regardless of provider). */
export function getActiveApiKeys(): UserApiKey[] {
  return readKeys().filter((key) => key.status === 'active');
}

/** The default key if it exists (after sanitization, there is at most one default). */
export function getDefaultApiKey(): UserApiKey | undefined {
  return readKeys().find((key) => key.isDefault);
}

/** Active keys sorted by priority: default first, then by creation date. */
export function listUsableApiKeys(): UserApiKey[] {
  const active = getActiveApiKeys();
  const sorted = [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const defaultIndex = sorted.findIndex((key) => key.isDefault);
  if (defaultIndex <= 0) {
    return sorted;
  }
  const defaultKey = sorted.splice(defaultIndex, 1)[0];
  return [defaultKey, ...sorted];
}

export function evaluateKeyAccess(keys: readonly UserApiKey[] = readKeys()): KeyAccessState {
  if (keys.length === 0) {
    return 'NO_API_KEY';
  }
  if (!keys.some((key) => key.status === 'active')) {
    return 'ALL_KEYS_EXHAUSTED';
  }
  return 'READY';
}

/* --------------------------- Subscription and Snapshots --------------------------- */

/**
 * Subscribe to key changes (local change + other tabs),
 * designed to work directly with useSyncExternalStore.
 */
export function subscribeToApiKeysChanges(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorageFromOtherTab = () => {
    cachedRaw = null; // Invalidate cache then notify listener
    listener();
  };
  window.addEventListener(API_KEYS_CHANGED_EVENT, listener);
  window.addEventListener('storage', onStorageFromOtherTab);
  return () => {
    window.removeEventListener(API_KEYS_CHANGED_EVENT, listener);
    window.removeEventListener('storage', onStorageFromOtherTab);
  };
}

/** General keys snapshot (referentially stable) for display in the interface. */
export function getPublicApiKeysSnapshot(): PublicUserApiKey[] {
  if (!isStorageAvailable()) {
    return EMPTY_PUBLIC_KEYS;
  }
  refreshCache();
  return cachedPublic;
}

/** Server snapshot: a fixed empty list. */
export function getEmptyPublicApiKeys(): PublicUserApiKey[] {
  return EMPTY_PUBLIC_KEYS;
}

/** Access status snapshot (primitive text, inherently stable). */
export function getKeyAccessSnapshot(): KeyAccessState {
  return evaluateKeyAccess();
}

/** Server snapshot for access status. */
export function getDefaultKeyAccess(): KeyAccessState {
  return 'READY';
}

/* ------------------------------- Writing --------------------------------- */

export function addApiKey(input: AddApiKeyInput): UserApiKey {
  const keys = readKeys();
  const newKey: UserApiKey = {
    id: crypto.randomUUID(),
    provider: input.provider,
    label: input.label.trim(),
    apiKey: input.apiKey.trim(),
    status: 'active',
    isDefault: keys.length === 0,
    createdAt: new Date().toISOString(),
  };
  writeKeys([...keys, newKey]);
  return newKey;
}

/**
 * Safely delete a key:
 * - Deleting a normal key does not break the interface.
 * - If the deleted key was the default, the oldest active key (or oldest key
 *   overall) is promoted to be the new default, instead of leaving the system without an intended default.
 */
export function deleteApiKey(id: string): void {
  const keys = readKeys();
  const target = keys.find((key) => key.id === id);
  if (!target) {
    return;
  }
  let remaining = keys.filter((key) => key.id !== id);

  if (target.isDefault && remaining.length > 0) {
    const byCreatedAt = [...remaining].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const replacement = byCreatedAt.find((key) => key.status === 'active') ?? byCreatedAt[0];
    if (replacement) {
      remaining = remaining.map((key) =>
        key.id === replacement.id ? { ...key, isDefault: true } : key,
      );
    }
  }

  writeKeys(remaining);
}

/** Sets the default key while resetting any other defaults. */
export function setDefaultApiKey(id: string): void {
  writeKeys(readKeys().map((key) => ({ ...key, isDefault: key.id === id })));
}

export function updateApiKeyStatus(id: string, status: ApiKeyStatus): void {
  writeKeys(readKeys().map((key) => (key.id === id ? { ...key, status } : key)));
}

/** Renames an existing key; returns false if unsuccessful. */
export function renameApiKey(id: string, label: string): boolean {
  const trimmedLabel = label.trim();
  if (trimmedLabel.length === 0) {
    return false;
  }
  const keys = readKeys();
  if (!keys.some((key) => key.id === id)) {
    return false;
  }
  writeKeys(keys.map((key) => (key.id === id ? { ...key, label: trimmedLabel } : key)));
  return true;
}

/**
 * Detects duplicate key values for a specific provider before saving.
 * The resulting message about duplication in the interface never reveals the value itself.
 */
export function hasDuplicateApiKey(provider: ProviderName, apiKey: string): boolean {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length === 0) {
    return false;
  }
  return readKeys().some((key) => key.provider === provider && key.apiKey === trimmedKey);
}

/** Applies state updates coming from the server (e.g., marking a key as exhausted). */
export function applyKeyStatusUpdates(updates: readonly KeyStatusUpdate[]): void {
  if (updates.length === 0) {
    return;
  }
  const statusById = new Map(updates.map((update) => [update.keyId, update.status]));
  writeKeys(
    readKeys().map((key) => {
      const nextStatus = statusById.get(key.id);
      return nextStatus ? { ...key, status: nextStatus } : key;
    }),
  );
}

/* ------------------------------ Safe Display ------------------------------ */

/**
 * Masks the key for display in the interface.
 * Example: "AIza••••••••••1234" — only the first 4 and last 4 characters.
 * Short keys (8 characters or less) are fully masked so they cannot be inferred.
 */
export function maskApiKey(apiKey: string): string {
  const value = apiKey.trim();
  if (value.length <= 8) {
    return MASK_FILL;
  }
  return `${value.slice(0, 4)}${MASK_FILL}${value.slice(-4)}`;
}

/** Safe version for the interface: never contains the raw key value. */
export function toPublicApiKey(key: UserApiKey): PublicUserApiKey {
  return {
    id: key.id,
    provider: key.provider,
    label: key.label,
    status: key.status,
    isDefault: key.isDefault,
    createdAt: key.createdAt,
    keyPreview: maskApiKey(key.apiKey),
  };
}
