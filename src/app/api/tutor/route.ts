/**
 * POST /api/tutor — واجهة شات المدرّس.
 *
 * هذا الملف طبقة HTTP رفيعة فقط:
 * - قراءة الجسم والتحقق منه عبر Zod (400 آمن عند الفشل).
 * - تفويض منطق العمل كاملًا إلى "tutor-service".
 * - ترجمة النتيجة إلى استجابة JSON بحالة HTTP المناسبة.
 *
 * قواعد: لا تُسجَّل رسائل الطالب ولا المفاتيح ولا الـ prompt في السجلات،
 * ولا تُكشف أي تفاصيل داخلية في الاستجابات.
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import {
  httpStatusForResponse,
  safeTutorError,
  unknownErrorToTutorError,
} from '@/lib/tutor/tutor-error-handler';
import { toTutorRequest } from '@/lib/tutor/tutor-request';
import { buildErrorResponse } from '@/lib/tutor/tutor-response';
import { processTutorRequest, startTutorStream } from '@/lib/tutor/tutor-service';
import { encodeSseEvent } from '@/lib/tutor/tutor-stream';
import { summarizeZodIssues, tutorChatRequestSchema } from '@/lib/validation/tutor-schemas';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    const response = buildErrorResponse(
      safeTutorError('VALIDATION_ERROR', 'تعذر قراءة جسم الطلب بصيغة JSON.'),
    );
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  }

  const parsed = tutorChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const zodError = parsed.error as ZodError;
    const response = buildErrorResponse(
      safeTutorError(
        'VALIDATION_ERROR',
        `فشل التحقق من صحة الطلب. ${summarizeZodIssues(zodError)}`,
      ),
    );
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  }

  /* ------------------------- مسار البث (stream: true) ------------------------ */
  if (parsed.data.stream === true) {
    try {
      // كل التحقق واختيار المفتاح يحدث داخل الخدمة قبل بدء البث؛
      // إشارة إلغاء الاتصال تُمرر إلى المزود لإيقاف الاستهلاك.
      const outcome = await startTutorStream(toTutorRequest(parsed.data), {
        signal: request.signal,
      });

      if (!outcome.ok) {
        return NextResponse.json(outcome.response, {
          status: httpStatusForResponse(outcome.response),
        });
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of outcome.events) {
              controller.enqueue(encoder.encode(encodeSseEvent(event)));
            }
          } catch {
            // خطأ غير متوقع أثناء الكتابة: نغلق البث بهدوء دون تسريب تفاصيل.
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch {
      const response = buildErrorResponse(unknownErrorToTutorError());
      return NextResponse.json(response, { status: httpStatusForResponse(response) });
    }
  }

  /* ---------------------- المسار العادي (غير التدفقي) ---------------------- */
  try {
    const response = await processTutorRequest(toTutorRequest(parsed.data));
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  } catch {
    // أي استثناء غير متوقع: استجابة عامة آمنة بحالة 500، بلا تفاصيل داخلية.
    const response = buildErrorResponse(unknownErrorToTutorError());
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  }
}
