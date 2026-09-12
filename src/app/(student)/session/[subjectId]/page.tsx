import { notFound } from 'next/navigation';
import { TutorChat } from '@/components/tutor/tutor-chat';
import { getSubjectById } from '@/lib/sessions/subject-catalog';
import { urlSubjectIdSchema } from '@/lib/validation/session-schemas';

interface SessionPageProps {
  params: Promise<{ subjectId: string }>;
}

/**
 * Subject session page. The subject is a fixed part of the URL: /session/[subjectId]
 * and cannot be changed within the session itself.
 * The URL value is validated via Zod and then against the active subject catalog.
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