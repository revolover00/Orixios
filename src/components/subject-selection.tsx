'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { matchSubjectName } from '@/lib/sessions/subject-matcher';
import { SUBJECTS } from '@/lib/sessions/subjects';
import type { SubjectId, Subject } from '@/types/sessions';

function SubjectIcon({ subjectId }: { subjectId: SubjectId }) {
  const paths: Record<SubjectId, React.ReactNode> = {
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

function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <Link
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
  );
}

export function SubjectSelection() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const match = useMemo(() => matchSubjectName(query), [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (match.exact) {
      router.push(`/session/${match.exact.id}`);
    }
  };

  // Determine what to show: exact match, suggestions, or all subjects if query is empty.
  const displaySubjects = query.trim() === '' 
    ? SUBJECTS 
    : (match.exact ? [match.exact] : match.suggestions);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-foreground">ابدأ جلسة في مادة</h2>
      
      <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن مادة، مثلاً: رياضيات، فيزياء..."
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
        />
        <button
          type="submit"
          disabled={!match.exact}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary/90"
        >
          ابدأ الجلسة
        </button>
      </form>

      {displaySubjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {displaySubjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          لم يتم العثور على مواد تطابق بحثك.
        </div>
      )}
    </section>
  );
}
