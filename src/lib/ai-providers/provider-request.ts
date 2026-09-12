/**
 * شكل الطلب الموحّد المرسل إلى أي مزود ذكاء اصطناعي.
 * هذا التجريد يفصل طبقة الشات عن تفاصيل أي مزود بعينه.
 */

export interface ProviderRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderGenerateRequest {
  systemPrompt: string;
  messages: ProviderRequestMessage[];
  /** مفتاح المستخدم؛ لا يُسجَّل ولا يُعاد في أي استجابة. */
  apiKey: string;
  /** نموذج اختياري؛ عند الغياب يُستخدم النموذج الافتراضي للمزود. */
  model?: string;
}

/** طلب البث: نفس طلب التوليد مع إشارة إلغاء اختيارية. */
export interface ProviderStreamRequest extends ProviderGenerateRequest {
  signal?: AbortSignal;
}
