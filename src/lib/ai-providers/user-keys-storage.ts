/**
 * تخزين مفاتيح المستخدم (طبقة abstraction مستقلة عن React).
 *
 * ⚠️ تحذير أمني مهم:
 * - التخزين في localStorage حل مؤقت للتطوير المحلي فقط، ولا يُعتبر آمنًا
 *   للإنتاج أبدًا (أي سكربت في الصفحة قادر على قراءة المفاتيح).
 * - مفاتيح الإنتاج يجب تخزينها بتشفير قوي عبر Backend/Supabase Vault،
 *   مع الحفاظ على نفس تواقيع هذه الطبقة حتى لا تتغير الجهات المستدعية.
 * - لا تُطبع المفاتيح أو قيمها في console في أي مسار من هذه الوحدة.
 *
 * الحمايات المنفذة:
 * - العمل على الخادم حيث لا يوجد localStorage (إرجاع قوائم فارغة بأمان).
 * - JSON تالف داخل localStorage (تجاهل آمن).
 * - بيانات قديمة لا تطابق النوع الحالي (تعقيم كل مدخل قبل قبوله).
 * - وجود أكثر من مفتاح افتراضي (يُطبَّق افتراضي واحد فقط: الأول).
 * - مفتاح بدون provider صالح أو بدون apiKey (يُستبعد تمامًا).
 *
 * اللقطات (Snapshots) مستقرة المرجع كي تعمل مع useSyncExternalStore
 * دون حلقات إعادة تصيير.
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

/** حدث يُبث عند أي تغيير حتى تحدّث الواجهات حالة القفل فورًا. */
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
    // في بعض الأوضاع (الخصوصية مثلًا) يرمي الوصول إلى التخزين استثناءً.
    return typeof window.localStorage !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
}

/* ------------------------- تعقيم البيانات المخزنة ------------------------- */

/**
 * يفرض افتراضيًا واحدًا فقط: أول مفتاح يحمل isDefault يبقى افتراضيًا
 * والبقية تُصفَّر. يعالج البيانات القديمة أو المحررة يدويًا.
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
 * تعقيم قيمة مقروءة من التخزين:
 * يستبعد أي مدخل ليس كائنًا، أو يفتقد id/provider/apiKey صالحة،
 * ويصحح الحقول الاختيارية، ثم يفرض افتراضيًا واحدًا.
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

    // مفتاح بدون provider معروف أو بدون apiKey أو بدون id يُستبعد بالكامل.
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

/* ---------------------- ذاكرة مؤقتة للقطة المستقرة ----------------------- */

let cachedRaw: string | null = null;
let cachedKeys: UserApiKey[] = [];
let cachedPublic: PublicUserApiKey[] = [];
/**
 * وضع "الذاكرة فقط": يُفعَّل عند فشل الكتابة الأخيرة، فتُخدم القراءات
 * من الذاكرة المؤقتة (نية المستخدم الأخيرة) حتى تنجح كتابة تالية.
 */
let memoryOnly = false;

/** يحدّث الذاكرة المؤقتة فقط إذا تغيّرت القيمة الخام في التخزين. */
function refreshCache(): UserApiKey[] {
  if (memoryOnly) {
    // كتابة سابقة فشلت: نُبقي حالة الذاكرة المؤقتة مصدرًا للحقيقة
    // بدل قراءة قيمة قديمة من التخزين وإظهار اختفاء المفاتيح.
    return cachedKeys;
  }
  let raw = '';
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // فشل وصول التخزين: نعيد آخر لقطة صالحة دون كسر التطبيق،
    // ولا تُضمَّن أي قيم مفاتيح في أي مسار خطأ.
    return cachedKeys;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let parsed: unknown = [];
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // JSON تالف: نتجاهله بأمان وكأن التخزين فارغ.
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
    // فشل الكتابة (مثل امتلاء التخزين): نُبقي الحالة في الذاكرة المؤقتة
    // حتى لا تنكسر الواجهة، مع تجاهل الخطأ بأمان (بلا قيم مفاتيح في أي سجل).
    memoryOnly = true;
  }
  cachedKeys = normalized;
  cachedPublic = normalized.map(toPublicApiKey);
  emitKeysChanged();
}

/* ------------------------------ القراءة ---------------------------------- */

export function listApiKeys(): UserApiKey[] {
  return readKeys();
}

/** المفاتيح النشطة فقط (بصرف النظر عن المزود). */
export function getActiveApiKeys(): UserApiKey[] {
  return readKeys().filter((key) => key.status === 'active');
}

/** المفتاح الافتراضي إن وُجد (بعد التعقيم يوجد افتراضي واحد على الأكثر). */
export function getDefaultApiKey(): UserApiKey | undefined {
  return readKeys().find((key) => key.isDefault);
}

/** المفاتيح النشطة مرتبة بالأولوية: الافتراضي أولًا ثم حسب تاريخ الإنشاء. */
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

/* --------------------------- الاشتراك واللقطات --------------------------- */

/**
 * اشتراك في تغييرات المفاتيح (تغيير محلي + تبويبات أخرى)،
 * مصمم للعمل مباشرة مع useSyncExternalStore.
 */
export function subscribeToApiKeysChanges(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorageFromOtherTab = () => {
    cachedRaw = null; // إبطال الذاكرة المؤقتة ثم إشعار المستمع
    listener();
  };
  window.addEventListener(API_KEYS_CHANGED_EVENT, listener);
  window.addEventListener('storage', onStorageFromOtherTab);
  return () => {
    window.removeEventListener(API_KEYS_CHANGED_EVENT, listener);
    window.removeEventListener('storage', onStorageFromOtherTab);
  };
}

/** لقطة المفاتيح العامة (مستقرة المرجع) للعرض في الواجهة. */
export function getPublicApiKeysSnapshot(): PublicUserApiKey[] {
  if (!isStorageAvailable()) {
    return EMPTY_PUBLIC_KEYS;
  }
  refreshCache();
  return cachedPublic;
}

/** لقطة الخادم: قائمة فارغة ثابتة. */
export function getEmptyPublicApiKeys(): PublicUserApiKey[] {
  return EMPTY_PUBLIC_KEYS;
}

/** لقطة حالة الوصول (نص بدائي، مستقر بطبيعته). */
export function getKeyAccessSnapshot(): KeyAccessState {
  return evaluateKeyAccess();
}

/** لقطة الخادم لحالة الوصول. */
export function getDefaultKeyAccess(): KeyAccessState {
  return 'READY';
}

/* ------------------------------- الكتابة --------------------------------- */

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
 * حذف مفتاح بأمان:
 * - حذف مفتاح عادي لا يكسر الواجهة.
 * - إذا كان المحذوف هو الافتراضي، يُرقَّى أقدم مفتاح نشط (أو أقدم مفتاح
 *   إجمالًا) ليكون الافتراضي الجديد، بدل ترك النظام بلا افتراضي مقصود.
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

/** يحدد المفتاح الافتراضي مع تصفير أي افتراضيات أخرى. */
export function setDefaultApiKey(id: string): void {
  writeKeys(readKeys().map((key) => ({ ...key, isDefault: key.id === id })));
}

export function updateApiKeyStatus(id: string, status: ApiKeyStatus): void {
  writeKeys(readKeys().map((key) => (key.id === id ? { ...key, status } : key)));
}

/** إعادة تسمية مفتاح موجود؛ ترجع false إذا تعذر ذلك. */
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
 * كشف تكرار قيمة مفتاح لمزود معيّن قبل الحفظ.
 * الرسالة الناتجة عن التكرار في الواجهة لا تكشف القيمة نفسها أبدًا.
 */
export function hasDuplicateApiKey(provider: ProviderName, apiKey: string): boolean {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length === 0) {
    return false;
  }
  return readKeys().some((key) => key.provider === provider && key.apiKey === trimmedKey);
}

/** تطبيق تحديثات الحالة القادمة من الخادم (مثل تعليم مفتاح مستنفد). */
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

/* ------------------------------ العرض الآمن ------------------------------ */

/**
 * إخفاء المفتاح للعرض في الواجهة.
 * مثال: "AIza••••••••••1234" — أول 4 محارف وآخر 4 فقط.
 * المفاتيح القصيرة (8 محارف فأقل) تُقنَّع بالكامل حتى لا تُستنتج.
 */
export function maskApiKey(apiKey: string): string {
  const value = apiKey.trim();
  if (value.length <= 8) {
    return MASK_FILL;
  }
  return `${value.slice(0, 4)}${MASK_FILL}${value.slice(-4)}`;
}

/** نسخة آمنة للواجهة: لا تحتوي القيمة الخام للمفتاح إطلاقًا. */
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
