export default function SessionLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-4 p-4 lg:flex-row">
      {/* Quiz Skeleton */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex animate-pulse flex-col items-center justify-center rounded-xl border border-border bg-surface p-8">
          <div className="mb-4 h-6 w-1/3 rounded-md bg-surface-muted"></div>
          <div className="mb-6 h-4 w-2/3 rounded-md bg-surface-muted"></div>
          <div className="h-10 w-32 rounded-lg bg-surface-muted"></div>
        </div>
      </div>
      {/* Chat Skeleton */}
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface">
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Tutor message */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20"></div>
            <div className="h-20 w-3/4 animate-pulse rounded-2xl rounded-tr-none bg-surface-muted"></div>
          </div>
          {/* User message */}
          <div className="flex items-start justify-end gap-3">
            <div className="h-12 w-1/2 animate-pulse rounded-2xl rounded-tl-none bg-primary/10"></div>
          </div>
          {/* Tutor message 2 */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20"></div>
            <div className="h-28 w-4/5 animate-pulse rounded-2xl rounded-tr-none bg-surface-muted"></div>
          </div>
        </div>
        <div className="border-t border-border p-4">
          <div className="h-12 w-full animate-pulse rounded-full bg-surface-muted"></div>
        </div>
      </div>
    </div>
  );
}
