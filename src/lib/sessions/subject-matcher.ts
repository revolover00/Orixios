/**
 * Matching the typed subject name with catalog subjects.
 *
 * The algorithm is intentionally simple and can be replaced later (with fuzzy matching or
 * automated classification) while maintaining the same signature:
 * 1. Normalize text: trim spaces, unify Latin characters, and simple Arabic normalization.
 * 2. Exact match with name/alternative/ID → "exact".
 * 3. Partial match (start of name or start of alternative) → "suggestions" only,
 *    without automatic selection if the match is weak.
 */

import type { Subject, SubjectId } from '@/types/sessions';
import { getAllSubjects, getSubjectAliases, getSubjectById } from './subject-catalog';

export interface SubjectNameMatch {
  exact: Subject | null;
  suggestions: Subject[];
}

/** Minimum text length to be considered valid for partial matching. */
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

/** Collects all accepted names for a subject: ID, standard name, Arabic name, and alternatives. */
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
 * Matches a typed subject name with the catalog.
 * Does not automatically select a subject if there is no clear match.
 */
export function matchSubjectName(input: string): SubjectNameMatch {
  const normalizedInput = normalizeText(input);
  if (normalizedInput.length === 0) {
    return { exact: null, suggestions: [] };
  }

  // 1) Exact match.
  const directSubject = getSubjectById(normalizedInput);
  if (directSubject) {
    return { exact: directSubject, suggestions: [] };
  }
  for (const subject of getAllSubjects()) {
    if (collectNames(subject).includes(normalizedInput)) {
      return { exact: subject, suggestions: [] };
    }
  }

  // 2) Partial match: suggestions only without automatic resolution.
  const suggestions = getAllSubjects().filter((subject) =>
    isPartialMatch(normalizedInput, subject),
  );

  return { exact: null, suggestions };
}

/* ------------------------- Old Compatible Interface ------------------------- */

export interface SubjectMatchResult {
  matched: boolean;
  subjectId: SubjectId | null;
  matchedText: string | null;
}

/**
 * Compatible with old calls: returns only exact matches,
 * and is internally built on top of matchSubjectName.
 */
export function resolveSubjectFromText(rawText: string): SubjectMatchResult {
  const match = matchSubjectName(rawText);
  if (match.exact) {
    return { matched: true, subjectId: match.exact.id, matchedText: match.exact.nameAr };
  }
  return { matched: false, subjectId: null, matchedText: null };
}
