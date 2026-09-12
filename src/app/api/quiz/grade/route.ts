import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runWithKeyRotation } from '@/lib/ai-providers/provider-selector';
import { getProviderClient } from '@/lib/ai-providers/provider-client';
import { resolveGroundedContext } from '@/lib/grounded-knowledge/knowledge-loader';
import { buildRemediationPrompt } from '@/lib/tutor-skills/remediation-skill';
import type { UserApiKey } from '@/types/providers';

const gradeRequestSchema = z.object({
  subjectId: z.string(),
  questionText: z.string(),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
  attemptCount: z.number().min(1),
  keys: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      label: z.string(),
      apiKey: z.string(),
      createdAt: z.string(),
      status: z.string(),
      isDefault: z.boolean(),
    })
  ).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = gradeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { subjectId, questionText, studentAnswer, correctAnswer, attemptCount, keys } = parsed.data;

    // Check strict equality first
    const isCorrect = studentAnswer.trim() === correctAnswer.trim();

    if (isCorrect) {
      return NextResponse.json({ isCorrect: true });
    }

    // If incorrect, we need remediation
    const knowledge = resolveGroundedContext({ subjectId });
    if (!knowledge.hasAvailableSource) {
      return NextResponse.json({ error: 'Subject knowledge not found' }, { status: 404 });
    }

    const systemPrompt = buildRemediationPrompt(questionText, studentAnswer, attemptCount, knowledge.context);
    const activeKeys = (keys || []) as UserApiKey[];

    const rotationOutcome = await runWithKeyRotation({
      keys: activeKeys,
      invoke: async (key) => {
        const client = getProviderClient(key.provider);
        const res = await client.generateResponse({
          systemPrompt,
          messages: [{ role: 'user', content: 'Generate the remediation.' }],
          apiKey: key.apiKey,
        });
        return res.text;
      },
    });

    if (!rotationOutcome.ok) {
      return NextResponse.json(
        { error: 'All providers failed or no active keys', keyStatusUpdates: rotationOutcome.keyStatusUpdates },
        { status: 503 }
      );
    }

    return NextResponse.json({
      isCorrect: false,
      remediationText: rotationOutcome.text,
      usedKeyId: rotationOutcome.usedKeyId,
      keyStatusUpdates: rotationOutcome.keyStatusUpdates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
