/**
 * طلب الشات بعد التحقق منه عبر Zod.
 *
 * قواعد الثقة:
 * - لا يُؤخذ أي "system prompt" أو "subjectName" من العميل؛
 *   الرسائل المسموحة "user" و"assistant" فقط.
 * - معرّفات الرسائل المرسلة من العميل تُهمل (لا تُثق ولا تُستخدم).
 * - اسم المادة يأتي من الجلسة والكتالوج في طبقة الخدمة.
 */

import type { UserKeyCredential } from '@/types/providers';
import type { SubjectId } from '@/types/sessions';
import type { ChatMessage } from '@/types/tutor';
import type { TutorChatRequestInput } from '@/lib/validation/tutor-schemas';

export interface TutorRequest {
  sessionId: string;
  subjectId: SubjectId;
  messages: ChatMessage[];
  currentTopic?: string;
  /**
   * مفاتيح المستخدم الصالحة (مرتبة: الافتراضي أولًا).
   * ضروري في مرحلة تخزين المفاتيح في المتصفح، وسيُستبدل لاحقًا
   * بجلب آمن عبر Supabase من جهة الخادم.
   */
  keys: UserKeyCredential[];
}

/** تحويل الجسم المتحقق منه إلى طلب الخدمة، مع إسقاط ما لا يُوثق به. */
export function toTutorRequest(validated: TutorChatRequestInput): TutorRequest {
  return {
    sessionId: validated.sessionId,
    subjectId: validated.subjectId,
    messages: validated.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    currentTopic: validated.currentTopic,
    keys: validated.keys,
  };
}
