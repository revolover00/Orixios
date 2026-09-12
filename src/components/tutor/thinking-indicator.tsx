/**
 * "Tutor is thinking" indicator while waiting for a response.
 * Simple and unobtrusive, does not display any internal reasoning to the user.
 */

export function ThinkingIndicator() {
  return (
    <div className="flex justify-end" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3">
        <span className="text-sm text-muted-foreground">المدرّس يفكر</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="tutor-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="tutor-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="tutor-dot h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      </div>
    </div>
  );
}
