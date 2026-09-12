/**
 * مخزن الجلسات المؤقت (Mock).
 *
 * التصميم:
 * - التخزين (SessionStorage) مفصول تمامًا عن منطق الجلسات (SessionStore)،
 *   ما يجعل الانتقال لاحقًا إلى Supabase ممكنًا دون تغيير واجهة الطبقة.
 * - لا تُستخدم قاعدة بيانات حقيقية في هذه المرحلة.
 * - مادة الجلسة ثابتة عند الإنشاء ولا يمكن تعديلها أبدًا.
 * - الجلسات المنتهية لا يمكن استخدامها.
 */

import type { SubjectId, TutorSession } from '@/types/sessions';
import { getSubjectById, isValidSubjectId } from './subject-catalog';
import { SessionError } from './session-errors';
import type { SessionStorage } from './types';

export interface CreateSessionInput {
  studentId: string;
  subjectId: SubjectId;
  /**
   * معرّف صريح اختياري: ضروري عندما يملك المتصل معرّف جلسة ثابتًا
   * (مثل جلسة الشات المرتبطة بالرابط). بدون ذلك يُولَّد UUID تلقائيًا.
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
 * معرّف الطالب المحلي المؤقت: في هذه المرحلة لا توجد مصادقة بعد،
 * ولاحقًا يُستبدل بمعرّف مستخدم Supabase دون تغيير واجهة الطبقة.
 */
export const LOCAL_STUDENT_ID = 'local-student';

/** تخزين في الذاكرة لأغراض التطوير فقط. */
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
    // لا تُنشأ جلسة لمادة غير موجودة أو غير نشطة.
    if (!isValidSubjectId(input.subjectId)) {
      throw new SessionError('INVALID_SUBJECT', { subjectId: input.subjectId });
    }
    const subject = getSubjectById(input.subjectId);
    if (!subject) {
      throw new SessionError('INVALID_SUBJECT', { subjectId: input.subjectId });
    }

    const sessionId = input.id ?? crypto.randomUUID();

    // منع إنشاء جلسة فوق معرّف موجود بالفعل.
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
   * فرض قفل المادة على الجلسة:
   * - جلسة غير موجودة ← SESSION_NOT_FOUND.
   * - جلسة منتهية ← SESSION_ENDED.
   * - مادة مختلفة ← SUBJECT_MISMATCH دون أي تعديل على الجلسة.
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

/** نسخة وحيدة على مستوى الخادم للتطبيق المؤقت. */
export const sessionStore: SessionStore = new BaseSessionStore(new InMemorySessionStorage());
