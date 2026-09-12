import { describe, expect, it } from 'vitest';
import { buildTutorSystemPrompt } from '@/lib/tutor-skills/tutor-system-prompt';
import type { TutorPromptContext } from '@/lib/tutor-skills/types';

function makeContext(overrides: Partial<TutorPromptContext> = {}): TutorPromptContext {
  return {
    subjectId: 'mathematics',
    subjectName: 'الرياضيات',
    sessionId: 'session-12345678',
    groundedContext: '2س + 5 = 13',
    hasAvailableSource: true,
    ...overrides,
  };
}

describe('buildTutorSystemPrompt', () => {
  it('includes subject name and socratic persona', () => {
    const prompt = buildTutorSystemPrompt(makeContext());
    expect(prompt).toContain('الرياضيات');
    expect(prompt).toContain('موجّه سقراطي');
    expect(prompt).toContain('لا تعطِ الإجابة النهائية');
  });

  it('includes grounded context when available', () => {
    const prompt = buildTutorSystemPrompt(makeContext());
    expect(prompt).toContain('لديك مصدر موثوق');
    expect(prompt).toContain('2س + 5 = 13');
  });

  it('includes out-of-source message when not available', () => {
    const prompt = buildTutorSystemPrompt(makeContext({ hasAvailableSource: false, groundedContext: '' }));
    expect(prompt).toContain('لا يوجد حاليًا مصدر موثوق');
    expect(prompt).toContain('عدم توفر مصدر موثوق');
  });

  it('includes current topic when provided', () => {
    const prompt = buildTutorSystemPrompt(makeContext({ currentTopic: 'المعادلات الخطية' }));
    expect(prompt).toContain('المعادلات الخطية');
  });
});
