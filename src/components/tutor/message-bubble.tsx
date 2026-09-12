/**
 * A single message bubble in the chat (student or tutor).
 * Content is displayed as plain text without any HTML — no use of dangerouslySetInnerHTML.
 */

import type { UiChatMessage } from '@/types/tutor';

const STATUS_LABELS: Record<NonNullable<UiChatMessage['status']>, string | null> = {
  sending: 'قيد الإرسال...',
  streaming: null, // The ongoing stream does not need an additional label.
  failed: 'لم تُرسل هذه الرسالة',
};

export function MessageBubble({ message }: { message: UiChatMessage }) {
  const isUser = message.role === 'user';
  const statusLabel =
    message.status === 'failed' && message.role === 'assistant'
      ? 'الرد غير مكتمل — يمكنك إعادة المحاولة'
      : (message.status ? STATUS_LABELS[message.status] : null);

  return (
    <div className={`flex min-w-0 ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[88%] sm:max-w-[75%] ${isUser ? 'items-start' : 'items-end'}`}>
        <p
          className={`mb-1 text-[11px] font-medium ${
            isUser ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {isUser ? 'أنت' : 'المدرّس'}
        </p>
        <div
          data-testid={isUser ? 'bubble-user' : 'bubble-assistant'}
          className={`whitespace-pre-wrap break-words rounded-2xl border px-4 py-3 text-sm leading-7 ${
            isUser
              ? 'rounded-tr-md border-primary/25 bg-primary/10 text-foreground'
              : 'rounded-tl-md border-border bg-surface text-foreground'
          } ${message.status === 'sending' ? 'opacity-70' : ''}`}
        >
          {message.content}
        </div>
        {statusLabel ? (
          <p
            className={`mt-1 text-[10px] ${
              message.status === 'failed' ? 'text-danger' : 'text-muted-foreground'
            }`}
            role={message.status === 'sending' ? 'status' : undefined}
          >
            {statusLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
