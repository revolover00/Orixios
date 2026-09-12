/**
 * Temporary session store (Mock).
 *
 * Design:
 * - Storage (SessionStorage) is completely separated from session logic (SessionStore),
 *   making a later transition to Supabase possible without changing the layer interface.
 * - No real database is used at this stage.
 * - Session subject is fixed at creation and can never be modified.
 * - Ended sessions cannot be used.
 */

import type { SubjectId, TutorSession } from '@/types/sessions';
import { getSubjectById, isValidSubjectId } from './subject-catalog';
import { SessionError } from './session-errors';
import type { SessionStorage } from './types';

export interface CreateSessionInput {
  studentId: string;
  subjectId: SubjectId;
  /**
   * Optional explicit ID: necessary when the caller has a fixed session ID
   * (e.g., chat session linked to the URL). Otherwise, a UUID is automatically generated.
   */
  id?: string;
}

export interface AssertSessionSubjectInput {
  sessionId: string;
  subjectId: string;
}

export interface GetActiveSessionInput {
  studentId: string;
  subjectId: SubjectId;
}

export interface SessionStore {
  createSession(input: CreateSessionInput): TutorSession;
  getSession(sessionId: string): TutorSession | null;
  getActiveSessionForSubject(input: GetActiveSessionInput): TutorSession | null;
  assertSessionSubject(input: AssertSessionSubjectInput): TutorSession;
  endSession(sessionId: string): TutorSession;
  listStudentSessions(studentId: string): TutorSession[];
}

/**
 * Temporary local student ID: at this stage, no authentication yet,
 * and later it will be replaced with a Supabase user ID without changing the layer interface.
 */
export const LOCAL_STUDENT_ID = 'local-student';

/** In-memory storage for development purposes only. */
class InMemorySessionStorage implements SessionStorage {
  private readonly sessions = new Map<string, TutorSession>();

  list(): TutorSession[] {
    return [...this.sessions.values()];
  }

  get(sessionId: string): TutorSession | undefined {
    return this.sessions.get(sessionId);
  }

  save(session: TutorSession): void {
    this.sessions.set(session.id, session);
  }
}

class BaseSessionStore implements SessionStore {
  constructor(private readonly storage: SessionStorage) {}

  createSession(input: CreateSessionInput): TutorSession {
    // A session is not created for a non-existent or inactive subject.
    if (!isValidSubjectId(input.subjectId)) {
      throw new SessionError('INVALID_SUBJECT', { subjectId: input.subjectId });
    }
    const subject = getSubjectById(input.subjectId);
    if (!subject) {
      throw new SessionError('INVALID_SUBJECT', { subjectId: input.subjectId });
    }

    const sessionId = input.id ?? crypto.randomUUID();

    // Prevent creating a session over an already existing ID.
    if (this.storage.get(sessionId)) {
      throw new SessionError('SESSION_ALREADY_EXISTS', { sessionId });
    }

    const session: TutorSession = {
      id: sessionId,
      studentId: input.studentId,
      subjectId: subject.id,
      subjectName: subject.nameAr,
      status: 'active',
      startedAt: new Date().toISOString(),
    };

    this.storage.save(session);
    return session;
  }

  getSession(sessionId: string): TutorSession | null {
    return this.storage.get(sessionId) ?? null;
  }

  getActiveSessionForSubject(input: GetActiveSessionInput): TutorSession | null {
    const match = this.storage
      .list()
      .filter(
        (session) =>
          session.studentId === input.studentId &&
          session.subjectId === input.subjectId &&
          session.status === 'active',
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return match[0] ?? null;
  }

  /**
   * Enforce subject lock on the session:
   * - Non-existent session → SESSION_NOT_FOUND.
   * - Ended session → SESSION_ENDED.
   * - Different subject → SUBJECT_MISMATCH without any modification to the session.
   */
  assertSessionSubject(input: AssertSessionSubjectInput): TutorSession {
    if (!isValidSubjectId(input.subjectId)) {
      throw new SessionError('INVALID_SUBJECT', {
        sessionId: input.sessionId,
        subjectId: input.subjectId,
      });
    }

    const session = this.storage.get(input.sessionId);
    if (!session) {
      throw new SessionError('SESSION_NOT_FOUND', { sessionId: input.sessionId });
    }
    if (session.status === 'ended') {
      throw new SessionError('SESSION_ENDED', { sessionId: session.id });
    }
    if (session.subjectId !== input.subjectId) {
      throw new SessionError('SUBJECT_MISMATCH', {
        sessionId: session.id,
        subjectId: input.subjectId,
      });
    }
    return session;
  }

  endSession(sessionId: string): TutorSession {
    const session = this.storage.get(sessionId);
    if (!session) {
      throw new SessionError('SESSION_NOT_FOUND', { sessionId });
    }
    if (session.status === 'ended') {
      throw new SessionError('SESSION_ENDED', { sessionId });
    }

    const endedSession: TutorSession = {
      ...session,
      status: 'ended',
      endedAt: new Date().toISOString(),
    };
    this.storage.save(endedSession);
    return endedSession;
  }

  listStudentSessions(studentId: string): TutorSession[] {
    return this.storage
      .list()
      .filter((session) => session.studentId === studentId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}

/** Single server-side instance for temporary application. */
export const sessionStore: SessionStore = new BaseSessionStore(new InMemorySessionStorage());
