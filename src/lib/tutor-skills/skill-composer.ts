/**
 * Skill composer: integrates independent skills into a single instruction block.
 *
 * Rules:
 * - The integration order is fixed, non-random, and testable (order array below).
 * - No duplication of the same skill (first appearance wins), so instructions are not repeated unnecessarily.
 * - The composer passes the same context to all skills: it cannot choose another subject
 *   or pass grounded context for a different subject.
 * - Adding a new skill = passing it in the array without modifying the rest of the system.
 */

import { explanationSkill } from './explanation-skill';
import { groundedSourceSkill } from './grounded-source-skill';
import { sessionSubjectLockSkill } from './session-subject-lock-skill';
import type { TutorPromptContext, TutorSkill, TutorSkillName } from './types';

/** The fixed, adopted order for core skills. */
export const DEFAULT_SKILL_ORDER: readonly TutorSkillName[] = [
  'session-subject-lock',
  'grounded-source',
  'explanation',
];

/** Core skills in their fixed order. */
export function getDefaultTutorSkills(): TutorSkill[] {
  return [sessionSubjectLockSkill, groundedSourceSkill, explanationSkill];
}

/**
 * Integrates skill instructions according to the passed array order.
 * If no skills are passed, default core skills are used.
 */
export function composeTutorInstructions(
  context: TutorPromptContext,
  skills: readonly TutorSkill[] = getDefaultTutorSkills(),
): string {
  const seenNames = new Set<string>();
  const blocks: string[] = [];

  for (const skill of skills) {
    if (seenNames.has(skill.name)) {
      continue; // No duplication of the same skill
    }
    seenNames.add(skill.name);

    const instructions = skill.getInstructions(context).trim();
    if (instructions.length > 0) {
      blocks.push(instructions);
    }
  }

  return blocks.join('\n\n');
}
