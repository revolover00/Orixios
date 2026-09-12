/**
 * مطابقة اسم المادة المكتوب مع مواد الكتالوج.
 *
 * الخوارزمية بسيطة عمدًا وقابلة للاستبدال لاحقًا (بمطابقة ضبابية أو
 * تصنيف آلي) مع الحفاظ على نفس التوقيع:
 * 1. تطبيع النص: قص المسافات، توحيد الحروف اللاتينية، وتطبيع عربي بسيط.
 * 2. تطابق تام مع اسم/بديل/معرّف ← "exact".
 * 3. تطابق جزئي (بداية اسم أو بداية بديل) ← "suggestions" فقط،
 *    دون اختيار تلقائي عند ضعف التطابق.
 */

import type { Subject, SubjectId } from '@/types/sessions';
import { getAllSubjects, getSubjectAliases, getSubjectById } from './subject-catalog';

export interface SubjectNameMatch {
  exact: Subject | null;
  suggestions: Subject[];
}

/** الطول الأدنى للنص حتى يُعتبر صالحًا للمطابقة الجزئية. */
const MIN_PARTIAL_LENGTH = 3;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** يجمع كل الأسماء المقبولة لمادة: المعرّف، الاسم القياسي، العربي، والبدائل. */
function collectNames(subject: Subject): string[] {
  return [subject.id, subject.name, subject.nameAr, ...getSubjectAliases(subject.id)].map(
    normalizeText,
  );
}

function isPartialMatch(normalizedInput: string, subject: Subject): boolean {
  if (normalizedInput.length < MIN_PARTIAL_LENGTH) {
    return false;
  }
  return collectNames(subject).some(
    (name) => name.startsWith(normalizedInput) || normalizedInput.startsWith(name),
  );
}

/**
 * يطابق اسم مادة مكتوبًا مع الكتالوج.
 * لا يختار مادة تلقائيًا عند غياب التطابق الواضح.
 */
export function matchSubjectName(input: string): SubjectNameMatch {
  const normalizedInput = normalizeText(input);
  if (normalizedInput.length === 0) {
    return { exact: null, suggestions: [] };
  }

  // 1) تطابق تام.
  const directSubject = getSubjectById(normalizedInput);
  if (directSubject) {
    return { exact: directSubject, suggestions: [] };
  }
  for (const subject of getAllSubjects()) {
    if (collectNames(subject).includes(normalizedInput)) {
      return { exact: subject, suggestions: [] };
    }
  }

  // 2) تطابق جزئي: اقتراحات فقط دون حسم تلقائي.
  const suggestions = getAllSubjects().filter((subject) =>
    isPartialMatch(normalizedInput, subject),
  );

  return { exact: null, suggestions };
}

/* ------------------------- واجهة توافقية قديمة ------------------------- */

export interface SubjectMatchResult {
  matched: boolean;
  subjectId: SubjectId | null;
  matchedText: string | null;
}

/**
 * متوافق مع الاستدعاءات القديمة: يعيد فقط التطابقات التامة،
 * ويُبنى داخليًا فوق matchSubjectName.
 */
export function resolveSubjectFromText(rawText: string): SubjectMatchResult {
  const match = matchSubjectName(rawText);
  if (match.exact) {
    return { matched: true, subjectId: match.exact.id, matchedText: match.exact.nameAr };
  }
  return { matched: false, subjectId: null, matchedText: null };
}
