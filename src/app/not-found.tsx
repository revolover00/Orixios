'use client';

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <h2 className="text-2xl font-bold">404 - الصفحة غير موجودة</h2>
      <p className="mt-2 text-muted-foreground">عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.</p>
    </div>
  );
}
