/**
 * POST /api/tutor — Tutor chat interface.
 *
 * This file is only a thin HTTP layer:
 * - Reads and validates the body via Zod (safe 400 on failure).
 * - Delegates all business logic to "tutor-service".
 * - Translates the result into a JSON response with the appropriate HTTP status.
 *
 * Rules: Student messages, keys, and prompts are not logged,
 * and no internal details are exposed in responses.
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

  /* ------------------------- Streaming path (stream: true) ------------------------ */
  if (parsed.data.stream === true) {
    try {
      // All validation and key selection happens within the service before streaming starts;
      // the abort signal is passed to the provider to stop consumption.
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
            // Unexpected error during writing: we close the stream gracefully without leaking details.
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

  /* ---------------------- Normal path (non-streaming) ---------------------- */
  try {
    const response = await processTutorRequest(toTutorRequest(parsed.data));
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  } catch {
    // Any unexpected exception: a safe generic 500 response, without internal details.
    const response = buildErrorResponse(unknownErrorToTutorError());
    return NextResponse.json(response, { status: httpStatusForResponse(response) });
  }
}