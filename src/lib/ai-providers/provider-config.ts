/**
 * Provider registry and settings.
 *
 * Current status:
 * - Only Gemini is actually active.
 * - OpenRouter and GitHub Models are inactive placeholders (no actual implementation yet).
 * - "mock" is a local development simulation tool (not an external AI provider),
 *   allowing chat testing without real keys, and can be disabled with a single flag.
 * - NVIDIA is intentionally excluded.
 *
 * Basic rule: the presence of an environment variable does not automatically make a provider available to students.
 * The only environment key read is a local development key, and under strict conditions below.
 *
 * Note: The creation of provider clients itself has moved to "provider-client.ts".
 */

import type { ProviderName, UserApiKey } from '@/types/providers';
import type { ProviderConfig } from './types';

/** Provider registry entry: standard configuration + display and operational data. */
export interface ProviderRegistryEntry extends ProviderConfig {
  description: string;
  defaultModel?: string;
  /** Local development simulation tool, not an external service. */
  isSimulation: boolean;
  /** Placeholder, not yet implemented. */
  isPlaceholder: boolean;
}

export const PROVIDERS: Record<ProviderName, ProviderRegistryEntry> = {
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    enabled: true,
    supportsReasoning: true,
    description: 'المزود الفعلي المفعّل عبر نماذج Google (يتطلب مفتاح مستخدم صالحًا)',
    defaultModel: 'gemini-2.5-flash',
    isSimulation: false,
    isPlaceholder: false,
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    enabled: false,
    supportsReasoning: false,
    description: 'عنصر نائب — غير مفعّل في هذه المرحلة',
    isSimulation: false,
    isPlaceholder: true,
  },
  'github-models': {
    name: 'github-models',
    displayName: 'GitHub Models',
    enabled: false,
    supportsReasoning: false,
    description: 'عنصر نائب — غير مفعّل في هذه المرحلة',
    isSimulation: false,
    isPlaceholder: true,
  },
  mock: {
    name: 'mock',
    displayName: 'مزود المحاكاة التطويري',
    enabled: true,
    supportsReasoning: false,
    description: 'محاكاة محلية للاستجابة وفق مصادر الجلسة، دون أي استدعاء خارجي',
    isSimulation: true,
    isPlaceholder: false,
  },
};

export function getProviderConfig(name: ProviderName): ProviderRegistryEntry {
  return PROVIDERS[name];
}

export function isProviderEnabled(name: ProviderName): boolean {
  return PROVIDERS[name]?.enabled === true;
}

export function listAllProviders(): ProviderRegistryEntry[] {
  return Object.values(PROVIDERS);
}

export function listEnabledProviders(): ProviderRegistryEntry[] {
  return listAllProviders().filter((provider) => provider.enabled);
}

/* ------------------------------------------------------------------ */
/* Development testing mode (isolated and protected by two conditions together)                     */
/* ------------------------------------------------------------------ */

/**
 * Is development testing mode active?
 * The only allowed reading of the mode's environment variable.
 */
export function isDevTestingMode(): boolean {
  return process.env.DEV_TESTING_MODE === 'true';
}

export const DEV_FALLBACK_KEY_ID = 'dev-fallback-gemini-key';

/**
 * Fallback key for local development only.
 *
 * Applied protections:
 * 1. Read only when DEV_TESTING_MODE=true (default: inactive).
 * 2. The student path never uses it automatically; its use requires an explicit option
 *    (allowDevEnvironmentFallback=true) passed to the selection function.
 * 3. Its value is not printed in logs and not included in any error message.
 *
 * The variable read is "GEMINI_API_KEY" as a local development key only,
 * and not a substitute for user keys in any production path.
 */
export function getDevTestingFallbackKey(): UserApiKey | null {
  if (!isDevTestingMode()) {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    id: DEV_FALLBACK_KEY_ID,
    provider: 'gemini',
    label: 'مفتاح تطوير محلي (وضع الاختبار فقط — ليس للإنتاج)',
    apiKey,
    status: 'active',
    isDefault: false,
    createdAt: new Date(0).toISOString(),
  };
}
