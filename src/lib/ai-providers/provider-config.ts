/**
 * سجل المزودات وإعداداتها.
 *
 * الحالة الحالية:
 * - Gemini فقط هو المزود المفعّل فعليًا.
 * - OpenRouter وGitHub Models عناصر نائبة غير مفعّلة (لا تنفيذ فعليًا بعد).
 * - "mock" أداة محاكاة تطويرية محلية (ليس مزود ذكاء اصطناعي خارجيًا)،
 *   تسمح بتجربة الشات دون مفاتيح حقيقية، ويمكن تعطيلها بعلامة واحدة.
 * - لا يوجد NVIDIA عمدًا.
 *
 * قاعدة أساسية: وجود متغير بيئي لا يجعل المزود متاحًا للطلاب تلقائيًا.
 * المفتاح البيئي الوحيد المقروء هو مفتاح تطوير محلي، وبشروط صارمة أدناه.
 *
 * ملاحظة: إنشاء عملاء المزودات نفسه انتقل إلى "provider-client.ts".
 */

import type { ProviderName, UserApiKey } from '@/types/providers';
import type { ProviderConfig } from './types';

/** مدخل سجل المزودات: إعداد قياسي + بيانات عرض وتشغيل. */
export interface ProviderRegistryEntry extends ProviderConfig {
  description: string;
  defaultModel?: string;
  /** أداة محاكاة تطويرية محلية وليست خدمة خارجية. */
  isSimulation: boolean;
  /** عنصر نائب غير منفّذ بعد. */
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
/* وضع الاختبار التطويري (معزول ومحمي بشرطين معًا)                     */
/* ------------------------------------------------------------------ */

/**
 * هل وضع الاختبار التطويري مفعّل؟
 * القراءة الوحيدة المسموحة لمتغير البيئة الخاص بالوضع.
 */
export function isDevTestingMode(): boolean {
  return process.env.DEV_TESTING_MODE === 'true';
}

export const DEV_FALLBACK_KEY_ID = 'dev-fallback-gemini-key';

/**
 * مفتاح fallback للتطوير المحلي فقط.
 *
 * الحماية المطبقة:
 * 1. يُقرأ فقط عندما يكون DEV_TESTING_MODE=true (الافتراضي: غير مفعّل).
 * 2. لا يستخدمه مسار الطالب تلقائيًا أبدًا؛ استخدامه يتطلب خيارًا صريحًا
 *    (allowDevEnvironmentFallback=true) يُمرر إلى دالة الاختيار.
 * 3. قيمته لا تُطبع في السجلات ولا تُضمَّن في أي رسالة خطأ.
 *
 * المتغير المقروء هو "GEMINI_API_KEY" بصفته مفتاح تطوير محلي فقط،
 * وليس بديلًا عن مفاتيح المستخدمين في أي مسار إنتاجي.
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
