/**
 * Grounded knowledge types + wrapping tags within the prompt.
 * Basic types are defined in "@/types/grounded-content".
 */

export type {
  GroundedContent,
  GroundedContextResult,
  GroundedSourceType,
} from '@/types/grounded-content';

/** Tags used to wrap sources within the system prompt and enable the simulation provider to read them. */
export const GROUNDED_SOURCES_START = '<<GROUNDED_SOURCES>>';
export const GROUNDED_SOURCES_END = '<<END_GROUNDED_SOURCES>>';
