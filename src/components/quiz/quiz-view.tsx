'use client';

import { useState } from 'react';
import type { Quiz, QuizQuestion } from '@/lib/quiz/types';
import { getPublicApiKeysSnapshot } from '@/lib/ai-providers/user-keys-storage';

interface QuizViewProps {
  subjectId: string;
}

export function QuizView({ subjectId }: QuizViewProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const [isGrading, setIsGrading] = useState(false);
  const [remediation, setRemediation] = useState<string | null>(null);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  const generateQuiz = async () => {
    setIsLoading(true);
    setError(null);
    setQuiz(null);
    try {
      const keys = getPublicApiKeysSnapshot();
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          quizType: 'end_of_lesson',
          numQuestions: 3,
          keys,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate quiz');
      }

      const data = await res.json();
      setQuiz(data.quiz);
      setCurrentQuestionIndex(0);
      setAttemptCounts({});
      setRemediation(null);
      setSelectedOption(null);
    } catch (err: any) {
      setError(err.message || 'Error generating quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!quiz || !selectedOption) return;

    const question = quiz.questions[currentQuestionIndex];
    if (!question) return;

    setIsGrading(true);
    setRemediation(null);

    const currentAttempt = (attemptCounts[question.id] || 0) + 1;
    setAttemptCounts((prev) => ({ ...prev, [question.id]: currentAttempt }));

    try {
      const keys = getPublicApiKeysSnapshot();
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          questionText: question.text,
          studentAnswer: selectedOption,
          correctAnswer: question.correctAnswer,
          attemptCount: currentAttempt,
          keys,
        }),
      });

      const data = await res.json();
      
      if (data.isCorrect) {
        // Move to next question or finish
        if (currentQuestionIndex < quiz.questions.length - 1) {
          setCurrentQuestionIndex((i) => i + 1);
          setSelectedOption(null);
        } else {
          // Finished
          setQuiz({ ...quiz, questions: [] }); // simple hack to show finish state
        }
      } else {
        setRemediation(data.remediationText);
      }
    } catch (err: any) {
      setError(err.message || 'Error grading answer');
    } finally {
      setIsGrading(false);
    }
  };

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8">
        <h2 className="mb-4 text-xl font-bold">اختبر معلوماتك</h2>
        <p className="mb-6 text-sm text-muted-foreground text-center">
          قم بتوليد اختبار قصير لتقييم فهمك للمادة، مع حلقة إتقان لتصحيح الأخطاء خطوة بخطوة.
        </p>
        <button
          onClick={generateQuiz}
          disabled={isLoading}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'جاري التوليد...' : 'ابدأ الاختبار'}
        </button>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (quiz.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-success">
        <h2 className="text-xl font-bold">أحسنت!</h2>
        <p className="mt-2 text-sm text-foreground">لقد أكملت الاختبار بنجاح وتم إتقان المفاهيم.</p>
        <button
          onClick={() => setQuiz(null)}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          اختبار جديد
        </button>
      </div>
    );
  }

  const question = quiz.questions[currentQuestionIndex];
  
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-primary">السؤال {currentQuestionIndex + 1} من {quiz.questions.length}</h3>
        <span className="text-xs text-muted-foreground">محاولات: {attemptCounts[question.id] || 0}</span>
      </div>

      <p className="mb-6 text-lg font-medium text-foreground">{question.text}</p>

      <div className="flex flex-col gap-3">
        {question.options.map((opt, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
              selectedOption === opt
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-surface-hover'
            }`}
          >
            <input
              type="radio"
              name="quiz-option"
              value={opt}
              checked={selectedOption === opt}
              onChange={() => setSelectedOption(opt)}
              className="h-4 w-4 text-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>

      {remediation && (
        <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <h4 className="mb-2 text-xs font-bold text-warning">توجيه المعلم:</h4>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{remediation}</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-8 flex justify-end">
        <button
          onClick={submitAnswer}
          disabled={!selectedOption || isGrading}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isGrading ? 'جاري التحقق...' : 'تأكيد الإجابة'}
        </button>
      </div>
    </div>
  );
}
