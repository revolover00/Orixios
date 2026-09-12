/**
 * الهيكل العام للتطبيق: شريط جانبي + منطقة محتوى رئيسية.
 * - سطح المكتب: الشريط الجانبي ثابت.
 * - الهاتف: يتحول إلى Drawer يفتح بزر القائمة.
 * - لا يعرض بيانات غير موجودة فعليًا (سجل الجلسات فارغ حتى تُنفذ الميزة).
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { SUBJECTS } from '@/lib/sessions/subjects';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        Ox
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-foreground">Orixios</span>
        <span className="block text-[10px] text-muted-foreground">مدرّسك الذكي</span>
      </span>
    </div>
  );
}

function navLinkClass(active: boolean): string {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
    active
      ? 'bg-surface-hover text-foreground'
      : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
  } focus:outline-none focus:ring-2 focus:ring-ring/60`;
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const currentSubject = SUBJECTS.find((subject) => pathname === `/session/${subject.id}`);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <Brand />
        <button
          type="button"
          onClick={onNavigate}
          aria-label="إغلاق القائمة"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="px-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          بدء محادثة جديدة
        </Link>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-2" aria-label="التنقل الرئيسي">
        <Link href="/" onClick={onNavigate} className={navLinkClass(pathname === '/')}>
          الرئيسية
        </Link>
        <Link
          href="/settings/api-keys"
          onClick={onNavigate}
          className={navLinkClass(pathname === '/settings/api-keys')}
        >
          مفاتيح المزودات
        </Link>
      </nav>

      <div className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-semibold text-muted-foreground">المواد</h2>
        <div className="flex flex-col gap-1">
          {SUBJECTS.map((subject) => {
            const href = `/session/${subject.id}`;
            return (
              <Link
                key={subject.id}
                href={href}
                onClick={onNavigate}
                className={navLinkClass(pathname === href)}
              >
                {subject.nameAr}
              </Link>
            );
          })}
        </div>
      </div>

      {currentSubject ? (
        <div className="mx-4 mt-4 rounded-xl border border-border bg-surface-muted px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground">الجلسة الحالية</p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">
            مادة {currentSubject.nameAr}
          </p>
        </div>
      ) : null}

      <div className="mx-4 mt-4">
        <h2 className="mb-2 text-[11px] font-semibold text-muted-foreground">سجل الجلسات</h2>
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
          لا يوجد سجل محفوظ للجلسات بعد.
        </p>
      </div>

      <div className="mt-auto border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">مظهر الواجهة</span>
          <ThemeToggle />
        </div>
        <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
          الحساب والمزامنة — قريبًا
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="hidden w-72 shrink-0 border-e border-border bg-surface lg:block">
        <SidebarContent onNavigate={closeMobile} />
      </aside>

      {/* الشريط الجانبي — الهاتف (Drawer) */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      ) : null}
      <aside
        aria-hidden={!mobileOpen}
        className={`fixed inset-y-0 start-0 z-40 w-72 border-e border-border bg-surface lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full opacity-0'
        }`}
      >
        <SidebarContent onNavigate={closeMobile} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* شريط علوي صغير — الهاتف فقط */}
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2.5 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <Brand />
          </div>
          <ThemeToggle />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
