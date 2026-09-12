/**
 * كتالوج المواد المؤقت.
 *
 * هذا الملف هو المكان الوحيد الذي تُعرَّف فيه أسماء المواد وبدائلها
 * (لتسهيل تعديلها أو إضافة مواد جديدة). لا يوضع منطق المواد داخل
 * مكوّنات React، ولا يعتمد الكتالوج على أي بيانات مستخدم.
 *
 * لاحقًا يمكن استبدال هذا الكتالوج بجدول في Supabase مع الحفاظ
 * على نفس الدوال.
 */

import type { Subject, SubjectId } from '@/types/sessions';

const SUBJECT_CATALOG: readonly Subject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    nameAr: 'الرياضيات',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'الجبر والهندسة وحل المسائل خطوة بخطوة',
  },
  {
    id: 'physics',
    name: 'Physics',
    nameAr: 'الفيزياء',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'الحركة والقوى والمفاهيم الأساسية للفيزياء',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    nameAr: 'الكيمياء',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'بنية المادة والعناصر والمركبات',
  },
  {
    id: 'arabic',
    name: 'Arabic',
    nameAr: 'اللغة العربية',
    grade: 'المرحلة الثانوية',
    curriculum: 'المنهج العام',
    isActive: true,
    description: 'النحو والصرف وبناء الجملة العربية',
  },
];

/**
 * أسماء شائعة وبديلة لكل مادة، تُستخدم في مطابقة الاسم المكتوب.
 * تُحرَّر هنا فقط، في نفس ملف الكتالوج.
 */
export const SUBJECT_NAME_ALIASES: Record<SubjectId, readonly string[]> = {
  mathematics: ['الرياضيات', 'رياضيات', 'رياضه', 'حساب', 'الجبر', 'جبر', 'math', 'maths', 'mathematics', 'algebra'],
  physics: ['الفيزياء', 'فيزياء', 'فيزيا', 'طبيعيات', 'physics', 'physic'],
  chemistry: ['الكيمياء', 'كيمياء', 'كيميا', 'كيميه', 'كيمستري', 'chemistry', 'chem'],
  arabic: ['اللغة العربية', 'لغة عربية', 'العربية', 'عربية', 'عربي', 'اللغه العربيه', 'نحو', 'النحو', 'arabic'],
};

/** كل المواد النشطة فقط. */
export function getAllSubjects(): Subject[] {
  return SUBJECT_CATALOG.filter((subject) => subject.isActive);
}

/**
 * البحث عن مادة بالمعرّف.
 * لا تُرجع مادة غير موجودة، ولا مادة غير نشطة.
 */
export function getSubjectById(subjectId: string): Subject | null {
  const found = SUBJECT_CATALOG.find(
    (subject) => subject.id === subjectId && subject.isActive,
  );
  return found ?? null;
}

/** حارس نوع لمعرّفات المواد الصالحة والنشطة فقط. */
export function isValidSubjectId(subjectId: string): subjectId is SubjectId {
  return getSubjectById(subjectId) !== null;
}

/** بدائل الأسماء لمادة معينة (للاستخدام في المطابقة). */
export function getSubjectAliases(subjectId: SubjectId): readonly string[] {
  return SUBJECT_NAME_ALIASES[subjectId];
}
