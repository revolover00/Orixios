/**
 * Message input field with an internal send button.
 * - Enter to send, Shift+Enter for a new line.
 * - Does not send empty messages or only spaces.
 * - Input is disabled during sending to prevent duplication.
 */

'use client';

import { useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  disabled: boolean;
  onSubmit: (content: string) => void;
  /** Is a stream currently active? The stop button appears instead of the send button during it. */
  streaming?: boolean;
  /** Stop the current stream via AbortController. */
  onStop?: () => void;
}

export function ChatInput({ disabled, onSubmit, streaming = false, onStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const trimmedEmpty = value.trim().length === 0;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-surface px-4 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative rounded-2xl border border-border bg-input focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring/40">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={3}
            placeholder="اكتب سؤالك للمدرّس هنا..."
            aria-label="رسالتك إلى المدرّس"
            className="max-h-48 w-full resize-none rounded-2xl bg-transparent px-4 pt-3.5 pb-12 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          {streaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="إيقاف الرد"
              className="absolute bottom-2.5 end-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
              إيقاف
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || trimmedEmpty}
              aria-label="إرسال الرسالة"
              className="absolute bottom-2.5 end-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground"
            >
              إرسال
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 -scale-x-100" aria-hidden="true">
                <path
                  d="M5 12h14m0 0-6-6m6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          الشرح يعتمد على مصادر الجلسة الموثوقة فقط، وقد يصرّح المدرّس بعدم توفر الجزئية
          خارجها.
        </p>
      </div>
    </div>
  );
}
