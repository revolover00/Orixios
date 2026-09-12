/**
 * Tutor skills layer types.
 *
 * Design: no single large system prompt; each skill is an independent unit
 * composed according to the conversation state via the skill composer.
 */

/** Names of integrated core skills. */
export const TUTOR_SKILL_NAMES = [
  'explanation',
  'grounded-source',
  'session-subject-lock',
] as const;

/**
 * Union of core names, with the "(string & {})" part allowing the addition of
 * new custom skills later without modifying the entire system, while retaining autocompletion
 * for core names.
 */
export type TutorSkillName = (typeof TUTOR_SKILL_NAMES)[number] | (string & {});

/** Instruction building context: everything skills need, and nothing outside. */
export interface TutorPromptContext {
  subjectId: string;
  subjectName: string;
  currentTopic?: string;
  /** Ready grounded context text (empty when no source is available). */
  groundedContext: string;
  hasAvailableSource: boolean;
  sessionId: string;
}

/** Independent, composable tutor skill. */
export interface TutorSkill {
  name: TutorSkillName;
  getInstructions(context: TutorPromptContext): string;
}
