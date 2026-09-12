/**
 * Chat message list in chronological order, with empty state and smart scrolling.
 * - Clearly distinguishes between student and tutor messages in RTL direction.
 * - During streaming: automatic scrolling only if the user is near the end,
 *   so as not to force them down while reading an old message.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { UiChatMessage } from '@/types/tutor';
import { MessageBubble } from './message-bubble';
import { ThinkingIndicator } from './thinking-indicator';

interface MessageListProps {
  messages: UiChatMessage[];
  isThinking: boolean;
  subjectName: string;
}

/** The distance from the bottom at which the user is considered "near the end". */
const NEAR_BOTTOM_THRESHOLD = 120;

export function MessageList({ messages, isThinking, subjectName }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    nearBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  useEffect(() => {
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isThinking]);

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
            <path
              d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4 3v-3h-.5A2.5 2.5 0 0 1 4 14.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M8 9h8M8 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-foreground">إزاي أقدر أساعدك النهارده؟</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          اسأل في أي جزئية من مادة {subjectName}، وهنمشي مع بعض خطوة بخطوة لحد ما توصل
          للفهم بنفسك. الشرح بيعتمد على مصادر الجلسة الموثوقة فقط.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto"
      role="log"
      aria-label="رسائل المحادثة"
    >
      <div className="flex min-w-0 flex-col gap-5 px-4 py-6 sm:px-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isThinking ? <ThinkingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
