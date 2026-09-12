/**
 * واجهة توافقية مع الاستيرادات القديمة.
 * المصدر الوحيد لبيانات المواد هو الآن "subject-catalog.ts".
 */

import type { Subject, SubjectId } from '@/types/sessions';
import { getAllSubjects, getSubjectById, isValidSubjectId } from './subject-catalog';

export const SUBJECTS: readonly Subject[] = getAllSubjects();

export function getSubject(id: SubjectId): Subject {
  const subject = getSubjectById(id);
  if (!subject) {
    throw new Error(`Subject not found: ${id}`);
  }
  return subject;
}

export function findSubjectById(id: string): Subject | undefined {
  return getSubjectById(id) ?? undefined;
}

export function isSubjectId(value: string): value is SubjectId {
  return isValidSubjectId(value);
}
