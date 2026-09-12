/**
 * Session layer types: storage interface separated from session logic.
 */

import type { TutorSession } from '@/types/sessions';

export type { SessionStatus, SubjectId, TutorSession } from '@/types/sessions';

/**
 * Session storage adapter.
 * Current implementation is in-memory; when Supabase is added later, another implementation
 * will be provided for the same interface without any change in session logic or consumers.
 */
export interface SessionStorage {
  list(): TutorSession[];
  get(sessionId: string): TutorSession | undefined;
  save(session: TutorSession): void;
}
