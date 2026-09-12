import Link from 'next/link';
import type { ReactNode } from 'react';
import { SUBJECTS } from '@/lib/sessions/subjects';
import type { SubjectId } from '@/types/sessions';

function SubjectIcon({ subjectId }: { subjectId: SubjectId }) {
  const paths: Record<SubjectId, ReactNode> = {
    mathematics: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 7h8M8 11h3m2 0h3M8 15h3m2 0h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    physics: (
      <>
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth="1.4" transform="rotate(60 12 12)" />
      </>
    ),
    chemistry: (
      <>
        <path
          d="M10 3h4m-3 0v6l-5.2 8.7A2 2 0 0 0 7.5 21h9a2 2 0 0 0 1.7-3.3L13 9V3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.5 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    arabic: (
      <>
        <path
          d="M12 5.5C10 4 7 4 5 5v13c2-1 5-1 7 .5 2-1.5 5-1.5 7-.5V5c-2-1-5-1-7 .5Zm0 0v13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      {paths[subjectId]}
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold text-primary">المرحلة الحالية: شات المدرّس</p>
        <h1 className="mt-2 text-2xl font-bold leading-relaxed text-foreground sm:text-3xl">
          تعلّم بأسلوب سقراطي، وبشرح يستند إلى مصادر موثوقة
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          اختر مادة لبدء جلسة مع المدرّس الذكي. كل جلسة مرتبطة بمادة واحدة، ويعتمد
          الشرح حصريًا على المصادر الموثوقة للجلسة. تحتاج أولًا إلى إضافة مفتاح مزود
          من صفحة مفاتيح المزودات.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">ابدأ جلسة في مادة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUBJECTS.map((subject) => (
            <Link
              key={subject.id}
              href={`/session/${subject.id}`}
              className="group flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 hover:border-border-strong hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <SubjectIcon subjectId={subject.id} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {subject.nameAr}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {subject.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">كيف تعمل هذه المرحلة؟</h2>
        <ul className="mt-3 grid gap-2 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
          <li>• المفاتيح تُخزَّن محليًا في المتصفح (تطوير فقط، وليس للإنتاج).</li>
          <li>• يمكنك تجربة الشات فورًا عبر مزود المحاكاة التطويري دون أي مفاتيح خارجية.</li>
          <li>• إذا استنفد مفتاح حصته ينتقل النظام تلقائيًا إلى المفتاح النشط التالي.</li>
          <li>• المادة ثابتة داخل الجلسة، وتغييرها يتطلب جلسة جديدة.</li>
        </ul>
      </section>
    </div>
  );
}
