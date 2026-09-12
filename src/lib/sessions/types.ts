/**
 * أنواع طبقة الجلسات: واجهة التخزين مفصولة عن منطق الجلسات.
 */

import type { TutorSession } from '@/types/sessions';

export type { SessionStatus, SubjectId, TutorSession } from '@/types/sessions';

/**
 * محوّل تخزين الجلسات.
 * التطبيق الحالي في الذاكرة؛ عند إضافة Supabase لاحقًا يُوفَّر تطبيق
 * آخر لنفس الواجهة دون أي تغيير في منطق الجلسات أو المستهلكين.
 */
export interface SessionStorage {
  list(): TutorSession[];
  get(sessionId: string): TutorSession | undefined;
  save(session: TutorSession): void;
}
