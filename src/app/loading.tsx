export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-muted border-t-primary"></div>
        <p className="animate-pulse text-sm font-medium text-muted-foreground">
          جاري التحميل...
        </p>
      </div>
    </div>
  );
}
