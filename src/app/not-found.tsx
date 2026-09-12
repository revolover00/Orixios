import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-lg font-bold text-foreground">الصفحة أو المادة غير موجودة</h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        تأكد من الرابط، أو اختر مادة من الصفحة الرئيسية لبدء جلسة جديدة.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
      >
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
