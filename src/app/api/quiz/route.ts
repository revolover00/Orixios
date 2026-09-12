import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveModel, runWithKeyRotation } from '@/lib/ai-providers/provider-selector';
import { getProviderClient } from '@/lib/ai-providers/provider-client';
import { resolveGroundedContext } from '@/lib/grounded-knowledge/knowledge-loader';
import { buildQuizGenerationPrompt } from '@/lib/tutor-skills/quiz-generation-skill';
import type { Quiz, QuizType } from '@/lib/quiz/types';
import type { UserApiKey } from '@/types/providers';

const quizRequestSchema = z.object({
  subjectId: z.string(),
  quizType: z.enum(['end_of_lesson', 'weekly', 'monthly', 'on_demand'] as const),
  numQuestions: z.number().min(1).max(20).default(5),
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
  ).optional(), // Passed from client
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = quizRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { subjectId, quizType, numQuestions, keys } = parsed.data;

    // Load source material
    const knowledge = resolveGroundedContext({ subjectId });
    if (!knowledge.hasAvailableSource) {
      return NextResponse.json({ error: 'Subject knowledge not found' }, { status: 404 });
    }

    // Prepare system prompt
    const systemPrompt = buildQuizGenerationPrompt(knowledge.context, numQuestions, quizType);

    const activeKeys = (keys || []) as UserApiKey[];

    // Execute with key rotation
    const rotationOutcome = await runWithKeyRotation({
      keys: activeKeys,
      invoke: async (key) => {
        const client = getProviderClient(key.provider);
        const res = await client.generateResponse({
          systemPrompt,
          messages: [{ role: 'user', content: 'Generate the quiz now.' }],
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

    let parsedJSON: any;
    try {
      // Clean up markdown block if present
      const rawText = rotationOutcome.text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedJSON = JSON.parse(rawText);
    } catch (e) {
      return NextResponse.json(
        { error: 'AI returned malformed JSON', text: rotationOutcome.text, keyStatusUpdates: rotationOutcome.keyStatusUpdates },
        { status: 500 }
      );
    }

    const quizResponse: Quiz = {
      subjectId,
      type: quizType as QuizType,
      questions: parsedJSON.questions || [],
    };

    return NextResponse.json({
      quiz: quizResponse,
      usedKeyId: rotationOutcome.usedKeyId,
      keyStatusUpdates: rotationOutcome.keyStatusUpdates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
