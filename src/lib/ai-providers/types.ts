/**
 * أنواع طبقة مزودي الذكاء الاصطناعي (BYOK).
 *
 * أنواع الـ مجال معرفة في "@/types/providers" وتُعاد هنا إعادة تصديرها
 * حتى تكون هذه الطبقة مكتفية ذاتيًا لمن يستوردها.
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

/** إعداد مزود كما يظهر للسجلات والاختيار. */
export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  enabled: boolean;
  supportsReasoning: boolean;
}

/** نتيجة اختيار ناجحة: المفتاح المختار + إعداد مزوده. */
export interface ProviderSelectionResult {
  key: UserApiKey;
  provider: ProviderConfig;
}

/** خيارات اختيار المفتاح النشط. */
export interface GetActiveModelOptions {
  /** البحث داخل مزود محدد فقط. */
  preferredProvider?: ProviderName;
  /**
   * خيار صريح يسمح باستخدام مفتاح البيئة التطويري عند غياب مفاتيح المستخدم.
   * لا يُحترم أبدًا إلا باجتماع شرطين: هذا الخيار = true و DEV_TESTING_MODE=true.
   */
  allowDevEnvironmentFallback?: boolean;
  /**
   * حقن المفاتيح مباشرة (للاختبار، أو لطلبات الخادم حيث تصل المفاتيح
   * في جسم الطلب). عند الغياب تُقرأ من تخزين المستخدم.
   */
  keys?: readonly UserApiKey[];
}

/** خيارات دورة الأخطاء والانتقال بين المفاتيح. */
export interface KeyRotationOptions {
  keys: readonly UserApiKey[];
  /** التنفيذ الفعلي مفصول عن منطق الاختيار (لا يخلط الاختيار بالإرسال). */
  invoke: (key: UserApiKey) => Promise<string>;
  preferredProvider?: ProviderName;
  /** حد أقصى لعدد المفاتيح التي تُجرَّب في الطلب الواحد. */
  maxAttempts?: number;
  /**
   * خطاف اختياري لتطبيق تغيير الحالة فورًا (مثل التخزين المحلي في العميل).
   * تحديثات الحالة تُجمع دائمًا في نتيجة الدورة أيضًا.
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
