/**
 * Temporary subject catalog.
 *
 * This file is the only place where subject names and their alternatives are defined
 * (to facilitate their modification or addition of new subjects). Subject logic is not placed within
 * React components, and the catalog does not rely on any user data.
 *
 * Later, this catalog can be replaced with a Supabase table while maintaining
 * the same functions.
 */

import type { Subject, SubjectId } from '@/types/sessions';

const SUBJECT_CATALOG: readonly Subject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    nameAr: 'الرياضيات',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'الجبر والهندسة وحل المسائل خطوة بخطوة',
  },
  {
    id: 'physics',
    name: 'Physics',
    nameAr: 'الفيزياء',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'الحركة والقوى والمفاهيم الأساسية للفيزياء',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    nameAr: 'الكيمياء',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'بنية المادة والعناصر والمركبات',
  },
  {
    id: 'arabic',
    name: 'Arabic',
    nameAr: 'اللغة العربية',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'النحو والصرف وبناء الجملة العربية',
  },
];

/**
 * Common and alternative names for each subject, used in matching the typed name.
 * Edited here only, in the same catalog file.
 */
export const SUBJECT_NAME_ALIASES: Record<SubjectId, readonly string[]> = {
  mathematics: ['الرياضيات', 'رياضيات', 'رياضه', 'حساب', 'الجبر', 'جبر', 'math', 'maths', 'mathematics', 'algebra'],
  physics: ['الفيزياء', 'فيزياء', 'فيزيا', 'طبيعيات', 'physics', 'physic'],
  chemistry: ['الكيمياء', 'كيمياء', 'كيميا', 'كيميه', 'كيمستري', 'chemistry', 'chem'],
  arabic: ['اللغة العربية', 'لغة عربية', 'العربية', 'عربية', 'عربي', 'اللغه العربيه', 'نحو', 'النحو', 'arabic'],
};

/** All active subjects only. */
export function getAllSubjects(): Subject[] {
  return SUBJECT_CATALOG.filter((subject) => subject.isActive);
}

/**
 * Search for a subject by ID.
 * Does not return a non-existent subject, nor an inactive subject.
 */
export function getSubjectById(subjectId: string): Subject | null {
  const found = SUBJECT_CATALOG.find(
    (subject) => subject.id === subjectId && subject.isActive,
  );
  return found ?? null;
}

/** Type guard for valid and active subject IDs only. */
export function isValidSubjectId(subjectId: string): subjectId is SubjectId {
  return getSubjectById(subjectId) !== null;
}

/** Alternative names for a specific subject (for use in matching). */
export function getSubjectAliases(subjectId: SubjectId): readonly string[] {
  return SUBJECT_NAME_ALIASES[subjectId];
}
