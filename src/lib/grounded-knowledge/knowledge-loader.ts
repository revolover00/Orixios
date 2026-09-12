/**
 * تحميل المحتوى الموثوق وبناء سياقه.
 *
 * قواعد صارمة:
 * - لا يُحمَّل محتوى من مادة مختلفة أبدًا.
 * - لا يُرجع محتوى غير نشط.
 * - عند غياب المحتوى: مصفوفة فارغة و "hasAvailableSource = false"،
 *   دون توليد بديل أو استخدام مادة قريبة أو اختراع سياق.
 * - لا تُستخدم مصادر خارج الـ Mock Data في هذه المرحلة.
 *
 * نقطة التوسعة: عند إضافة Supabase يُستبدل مصدر البيانات داخل هذه
 * الوحدة فقط، مع الحفاظ على نفس التواقيع.
 */

import type { GroundedContent, GroundedContextResult } from '@/types/grounded-content';
import type { SubjectId } from '@/types/sessions';
import { getSubjectById, isValidSubjectId } from '@/lib/sessions/subject-catalog';
import { KnowledgeError } from './knowledge-errors';
import { MOCK_GROUNDED_CONTENT } from './mock-content';

/** تسميات عرض أنواع المصادر داخل السياق. */
const SOURCE_TYPE_LABELS: Record<GroundedContent['sourceType'], string> = {
  teacher_transcript: 'Teacher transcript',
  whiteboard: 'Whiteboard',
  textbook: 'Textbook',
  ministry_exam: 'Ministry exam',
  mock: 'Mock development fixture',
};

function requireValidSubject(subjectId: string): SubjectId {
  if (!isValidSubjectId(subjectId)) {
    throw new KnowledgeError('UNKNOWN_SUBJECT', { subjectId });
  }
  return subjectId;
}

function normalizeForTopicMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يحمّل المحتوى النشط لمادة واحدة فقط.
 * يرمي KnowledgeError(UNKNOWN_SUBJECT) لمادة غير معروفة،
 * ويرجّع مصفوفة فارغة لمادة معروفة بلا محتوى.
 */
export function getGroundedContentForSubject(subjectId: string): GroundedContent[] {
  const validSubjectId = requireValidSubject(subjectId);
  return MOCK_GROUNDED_CONTENT.filter(
    (item) => item.subjectId === validSubjectId && item.isActive,
  );
}

/**
 * يحمّل محتوى موضوع محدد داخل مادة.
 * بدون موضوع: كل محتوى المادة. عند غياب الموضوع: مصفوفة فارغة
 * (لا نخلط موضوعات أخرى ولا نقترح مواد قريبة).
 */
export function getGroundedContentForTopic(input: {
  subjectId: string;
  topic?: string;
}): GroundedContent[] {
  const subjectContent = getGroundedContentForSubject(input.subjectId);
  const topic = input.topic?.trim();
  if (!topic) {
    return subjectContent;
  }

  const normalizedTopic = normalizeForTopicMatch(topic);
  return subjectContent.filter((item) => {
    const topicText = normalizeForTopicMatch(item.topic);
    const titleText = normalizeForTopicMatch(item.title);
    return topicText.includes(normalizedTopic) || titleText.includes(normalizedTopic);
  });
}

/**
 * يبني نتيجة السياق الموثوق الكاملة.
 * عند غياب المصادر: "hasAvailableSource = false" وسياق فارغ تمامًا،
 * ولا يُولَّد أي محتوى بديل.
 */
export function resolveGroundedContext(input: {
  subjectId: string;
  topic?: string;
}): GroundedContextResult {
  const validSubjectId = requireValidSubject(input.subjectId);
  const subject = getSubjectById(validSubjectId);
  const topic = input.topic?.trim();
  const contents = getGroundedContentForTopic({ subjectId: validSubjectId, topic });

  if (contents.length === 0 || !subject) {
    return {
      subjectId: validSubjectId,
      topic,
      contents: [],
      hasAvailableSource: false,
      context: '',
    };
  }

  const blocks = contents.map((item, index) => {
    const header =
      contents.length > 1
        ? `Grounded source (${index + 1}/${contents.length}):`
        : 'Grounded source:';
    return [
      header,
      `Subject: ${subject.name}`,
      `Topic: ${item.topic}`,
      `Source type: ${SOURCE_TYPE_LABELS[item.sourceType]}`,
      `Source reference: ${item.sourceReference}`,
      '',
      'Content:',
      item.content,
    ].join('\n');
  });

  return {
    subjectId: validSubjectId,
    topic,
    contents,
    hasAvailableSource: true,
    context: blocks.join('\n\n'),
  };
}

/**
 * يبني نص السياق الموثوق الجاهز للتمرير إلى system prompt لاحقًا.
 * يرجّع نصًا فارغًا عندما لا يوجد مصدر مناسب.
 */
export function buildGroundedContext(input: {
  subjectId: string;
  topic?: string;
}): string {
  return resolveGroundedContext(input).context;
}
