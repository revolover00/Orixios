/**
 * أنواع المعرفة الموثوقة + علامات التغليف داخل الـ prompt.
 * الأنواع الأساسية معرفة في "@/types/grounded-content".
 */

export type {
  GroundedContent,
  GroundedContextResult,
  GroundedSourceType,
} from '@/types/grounded-content';

/** علامات تُستخدم لتغليف المصادر داخل الـ system prompt وتمكين مزود المحاكاة من قراءتها. */
export const GROUNDED_SOURCES_START = '<<GROUNDED_SOURCES>>';
export const GROUNDED_SOURCES_END = '<<END_GROUNDED_SOURCES>>';
