/**
 * POST /api/sessions — إنشاء جلسة جديدة لمادة.
 *
 * ضرورة تشغيلية: واجهة الشات تتحقق من وجود الجلسة قبل أي طلب
 * (ولا يُسمح بإنشاء ضمني داخل /api/tutor)، لذلك تحتاج الواجهة
 * نقطة صريحة لإنشاء الجلسات.
 *
 * الطالب في هذه المرحلة هو الطالب المحلي المؤقت؛ لاحقًا يأتي
 * المعرّف من مصادقة Supabase.
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
      // المادة غير الموجودة/غير المتاحة تعامل كمورد غير موجود (404).
      const status = error.code === 'INVALID_SUBJECT' ? 404 : 500;
      return NextResponse.json(buildErrorResponse(body), { status });
    }
    return NextResponse.json(buildErrorResponse(unknownErrorToTutorError()), { status: 500 });
  }
}
