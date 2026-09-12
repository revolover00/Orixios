export type QuizType = 'end_of_lesson' | 'weekly' | 'monthly' | 'on_demand';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  subjectId: string;
  type: QuizType;
  questions: QuizQuestion[];
}

export interface QuestionGradeResult {
  isCorrect: boolean;
  remediationText?: string;
}
