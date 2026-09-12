/**
 * Domain types: Subjects, Sessions, and Session Errors.
 */

/** Valid subject IDs at this stage. */
export const SUBJECT_IDS = [
  'mathematics',
  'physics',
  'chemistry',
  'arabic',
] as const;

export type SubjectId = (typeof SUBJECT_IDS)[number];

/**
 * A study subject in the catalog.
 * - "name": Standard Latin name (appears in technical contexts).
 * - "nameAr": Arabic display name.
 * Additional fields (like description) are optional UI extensions.
 */
export interface Subject {
  id: SubjectId;
  name: string;
  nameAr: string;
  grade?: string;
  curriculum?: string;
  /** Inactive subjects are not displayed and no sessions are created for them. */
  isActive: boolean;
  description?: string;
}

export type SessionStatus = 'active' | 'ended';

/** A single tutoring session, linked to only one subject throughout its lifetime. */
export interface TutorSession {
  id: string;
  studentId: string;
  subjectId: SubjectId;
  subjectName: string;
  status: SessionStatus;
  /** Start date in ISO format. */
  startedAt: string;
  /** End date in ISO format if it exists. */
  endedAt?: string;
}

/** Session domain errors. */
export type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ENDED'
  | 'SUBJECT_MISMATCH'
  | 'INVALID_SUBJECT'
  | 'SESSION_ALREADY_EXISTS';
