/**
 * Loading grounded content and building its context.
 *
 * Strict rules:
 * - Content from a different subject is never loaded.
 * - Inactive content is not returned.
 * - When content is absent: empty array and "hasAvailableSource = false",
 *   without generating alternatives, using a similar subject, or inventing context.
 * - No sources outside Mock Data are used at this stage.
 *
 * Extension point: when Supabase is added, the data source will be replaced within this
 * module only, while maintaining the same signatures.
 */

import type { GroundedContent, GroundedContextResult } from '@/types/grounded-content';
import type { SubjectId } from '@/types/sessions';
import { getSubjectById, isValidSubjectId } from '@/lib/sessions/subject-catalog';
import { KnowledgeError } from './knowledge-errors';
import { MOCK_GROUNDED_CONTENT } from './mock-content';

/** Display labels for source types within the context. */
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
 * Loads active content for a single subject only.
 * Throws KnowledgeError(UNKNOWN_SUBJECT) for an unknown subject,
 * and returns an empty array for a known subject with no content.
 */
export function getGroundedContentForSubject(subjectId: string): GroundedContent[] {
  const validSubjectId = requireValidSubject(subjectId);
  return MOCK_GROUNDED_CONTENT.filter(
    (item) => item.subjectId === validSubjectId && item.isActive,
  );
}

/**
 * Loads content for a specific topic within a subject.
 * Without a topic: all subject content. If topic is absent: empty array
 * (we don't mix other topics or suggest similar subjects).
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
 * Builds the complete grounded context result.
 * When sources are absent: "hasAvailableSource = false" and completely empty context,
 * and no alternative content is generated.
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
 * Builds the grounded context text ready to be passed to the system prompt later.
 * Returns an empty string when no suitable source exists.
 */
export function buildGroundedContext(input: {
  subjectId: string;
  topic?: string;
}): string {
  return resolveGroundedContext(input).context;
}
