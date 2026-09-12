'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
          <h2 className="mb-4 text-2xl font-bold">حدث خطأ غير متوقع في النظام!</h2>
          <button
            onClick={() => reset()}
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
