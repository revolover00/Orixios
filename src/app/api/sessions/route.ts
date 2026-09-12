/**
 * POST /api/sessions — Create a new session for a subject.
 *
 * Operational necessity: The chat interface checks for the existence of a session before any request
 * (and implicit creation is not allowed within /api/tutor), so the interface needs
 * an explicit endpoint for creating sessions.
 *
 * The student at this stage is the temporary local student; later, the ID will come
 * from Supabase authentication.
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { SessionError } from '@/lib/sessions/session-errors';
import { LOCAL_STUDENT_ID, sessionStore } from '@/lib/sessions/session-store';
import {
  safeTutorError,
  sessionErrorToTutorError,
  unknownErrorToTutorError,
} from '@/lib/tutor/tutor-error-handler';
import { buildErrorResponse } from '@/lib/tutor/tutor-response';
import { subjectIdSchema } from '@/lib/validation/session-schemas';
import { summarizeZodIssues } from '@/lib/validation/tutor-schemas';

export const runtime = 'nodejs';

const createSessionBodySchema = z.object({
  subjectId: subjectIdSchema,
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      buildErrorResponse(safeTutorError('VALIDATION_ERROR', 'تعذر قراءة جسم الطلب بصيغة JSON.')),
      { status: 400 },
    );
  }

  const parsed = createSessionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const zodError = parsed.error as ZodError;
    return NextResponse.json(
      buildErrorResponse(
        safeTutorError('INVALID_SUBJECT', `المادة غير صالحة. ${summarizeZodIssues(zodError)}`),
      ),
      { status: 400 },
    );
  }

  try {
    const session = sessionStore.createSession({
      studentId: LOCAL_STUDENT_ID,
      subjectId: parsed.data.subjectId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId: session.id,
          subjectId: session.subjectId,
          subjectName: session.subjectName,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SessionError) {
      const body = sessionErrorToTutorError(error);
      // Non-existent/unavailable subject is treated as a not-found resource (404).
      const status = error.code === 'INVALID_SUBJECT' ? 404 : 500;
      return NextResponse.json(buildErrorResponse(body), { status });
    }
    return NextResponse.json(buildErrorResponse(unknownErrorToTutorError()), { status: 500 });
  }
}