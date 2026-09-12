import { notFound } from 'next/navigation';
import { TutorChat } from '@/components/tutor/tutor-chat';
import { getSubjectById } from '@/lib/sessions/subject-catalog';
import { urlSubjectIdSchema } from '@/lib/validation/session-schemas';

interface SessionPageProps {
  params: Promise<{ subjectId: string }>;
}

/**
 * صفحة جلسة المادة. المادة جزء ثابت من الرابط: /session/[subjectId]
 * ولا يمكن تغييرها داخل الجلسة نفسها.
 * يُتحقق من قيمة الرابط عبر Zod ثم عبر كتالوج المواد النشطة.
 */
export default async function SessionPage({ params }: SessionPageProps) {
  const { subjectId: rawSubjectId } = await params;

  const parsed = urlSubjectIdSchema.safeParse(rawSubjectId);
  if (!parsed.success) {
    notFound();
  }

  const subject = getSubjectById(parsed.data);
  if (!subject) {
    notFound();
  }

  return <TutorChat subject={subject} />;
}
