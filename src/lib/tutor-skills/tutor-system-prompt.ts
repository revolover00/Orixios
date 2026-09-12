/**
 * Tutor System Prompt builder.
 *
 * Internal structure in fixed order:
 * 1. Tutor's identity and role.
 * 2. Subject and session rules (subject lock skill).
 * 3. Grounded source rules (source skill).
 * 4. Socratic explanation style (explanation skill).
 * 5. Response format.
 * 6. Current grounded context.
 *
 * Rules:
 * - Validates context before building, and rejects incomplete context with a clear error.
 * - Relies only on the passed context; does not read external data or add
 *   educational information of its own.
 * - Does not include keys or sensitive data, and does not allow the student's message
 *   to override source rules or subject lock.
 */

import type { TutorPromptContext } from './types';
import {
  GROUNDED_SOURCES_START,
  GROUNDED_SOURCES_END,
} from '@/lib/grounded-knowledge/types';

export function buildTutorSystemPrompt(input: TutorPromptContext): string {
  const parts: string[] = [];

  // 1. Socratic guide persona and writing style
  parts.push(
    `أنت معلّم وموجّه سقراطي لمادة "${input.subjectName}".\n` +
    `مهمتك هي مساعدة الطالب على الوصول للإجابة بنفسه من خلال خطوات صغيرة وأسئلة توجيهية.\n` +
    `- لا تعطِ الإجابة النهائية أو الحل المباشر أبدًا.\n` +
    `- استخدم أسلوب كتابة طبيعي وغير روبوتي.\n` +
    `- حافظ على ردود قصيرة ومباشرة.\n` +
    `- ممنوع استخدام الإيموجي أو علامات التعجب الزائدة.\n`
  );

  // 2. Grounded source processing
  if (input.hasAvailableSource) {
    parts.push(
      `لديك مصدر موثوق ومحدد يجب أن تستمد منه شرحك حصريًا.\n` +
      `يُمنع منعًا باتًا إضافة أي معلومات أو تفاصيل غير موجودة حرفيًا في هذا المصدر المرفق.\n` +
      `اشرح دائمًا في حدود ما ورد في المصدر التالي:\n\n` +
      `${GROUNDED_SOURCES_START}\n` +
      `${input.groundedContext}\n` +
      `${GROUNDED_SOURCES_END}`
    );
  } else {
    parts.push(
      `لا يوجد حاليًا مصدر موثوق أو مرجع متاح لهذا الموضوع تحديدًا.\n` +
      `عليك التصريح الواضح للطالب بعدم توفر مصدر موثوق لهذا الموضوع، ولا تعتمد على معرفتك العامة بصمت.`
    );
  }

  // 3. Current topic (if any)
  if (input.currentTopic) {
    parts.push(`الموضوع الحالي الذي يدرسه الطالب هو: "${input.currentTopic}". ركز أسئلتك حوله.`);
  }

  return parts.join('\n\n');
}

