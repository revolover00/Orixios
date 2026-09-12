/**
 * Grounded Content types.
 * All tutor explanations must be based exclusively on these sources,
 * and it should never be claimed that experimental content is a real recording or book.
 */

import type { SubjectId } from './sessions';

export type GroundedSourceType =
  | 'teacher_transcript'
  | 'whiteboard'
  | 'textbook'
  | 'ministry_exam'
  | 'mock';

export interface GroundedContent {
  id: string;
  subjectId: SubjectId;
  title: string;
  /** The axis or lesson covered by the source. */
  topic: string;
  content: string;
  sourceType: GroundedSourceType;
  /** Source reference; in development, it is "development-fixture". */
  sourceReference: string;
  /** Inactive content is never loaded. */
  isActive: boolean;
}

/** Result of building grounded context for a specific subject/topic. */
export interface GroundedContextResult {
  subjectId: SubjectId;
  topic?: string;
  contents: GroundedContent[];
  /** false when no suitable source exists; no alternative context is generated then. */
  hasAvailableSource: boolean;
  context: string;
}
