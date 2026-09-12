'use client';
export const dynamic = 'force-dynamic';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Error</h2>
      </body>
    </html>
  );
}
