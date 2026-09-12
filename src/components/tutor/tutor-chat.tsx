/**
 * Main orchestrator for the tutor chat interface (progressive streaming).
 *
 * - Does not initiate any requests to the provider directly from the browser; everything goes through /api/tutor.
 * - The subject is fixed from the catalog (no trust in a subject name from the client or URL alone).
 * - Streaming: a thinking indicator appears until the first part, then the tutor's text gradually updates
 *   within the same bubble, and the message is considered complete only when a "done" event arrives.
 * - Cancellation via AbortController is safe: it is not considered an error and does not change the key status.
 * - Existing messages are not lost if a request fails, and the assistant message is not added
 *   until actual text arrives, and double sending is prevented.
 */

'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { Subject } from '@/types/sessions';
import type { UiChatMessage, UiMessageStatus } from '@/types/tutor';
import {
  applyKeyStatusUpdates,
  getKeyAccessSnapshot,
  getDefaultKeyAccess,
  listUsableApiKeys,
  subscribeToApiKeysChanges,
} from '@/lib/ai-providers/user-keys-storage';
import {
  postCreateSession,
  streamTutorChat,
  TutorClientError,
  type TutorChatPayload,
} from '@/lib/tutor/tutor-client';
import type { TutorErrorCode } from '@/types/tutor';
import { ChatInput } from './chat-input';
import { ChatLockState, type ChatLockVariant } from './chat-lock-state';
import { MessageList } from './message-list';

interface ChatErrorState {
  code: string;
  message: string;
  retryable: boolean;
}

type SessionLock = 'SESSION_ENDED' | 'SESSION_FAILED' | null;

interface TutorChatProps {
  subject: Subject;
}

export function TutorChat({ subject }: TutorChatProps) {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<ChatErrorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionLock, setSessionLock] = useState<SessionLock>(null);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Did the user stop the current stream themselves? Distinguishes intentional cancellation from interruption. */
  const stopRequestedRef = useRef(false);

  // Key access status is an external state (local storage) read with an interactive subscription.
  const lockState = useSyncExternalStore(
    subscribeToApiKeysChanges,
    getKeyAccessSnapshot,
    getDefaultKeyAccess,
  );

  // Cancel any ongoing stream when leaving the page — no state is updated here.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const setMessageStatus = useCallback(
    (messageId: string, status: UiMessageStatus | undefined) => {
      setMessages((previous) =>
        previous.map((message) => (message.id === messageId ? { ...message, status } : message)),
      );
    },
    [],
  );

  /** Create session server-side when needed, or reuse the current one. */
  const resolveSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }
    const created = await postCreateSession(subject.id);
    if (!created) {
      return null;
    }
    sessionIdRef.current = created.sessionId;
    return created.sessionId;
  }, [subject.id]);

  const sendConversation = useCallback(
    async (history: UiChatMessage[], userMessageId: string): Promise<void> => {
      const sessionId = await resolveSession();
      if (!sessionId) {
        setMessageStatus(userMessageId, 'failed');
        setSessionLock('SESSION_FAILED');
        setIsSending(false);
        return;
      }

      // Valid keys are sent only from the storage layer, and are not derived from user input.
      const payload: TutorChatPayload = {
        sessionId,
        subjectId: subject.id,
        messages: history.map((message) => ({ role: message.role, content: message.content })),
        keys: listUsableApiKeys().map((key) => ({
          id: key.id,
          provider: key.provider,
          apiKey: key.apiKey,
        })),
      };

      const controller = new AbortController();
      abortRef.current = controller;
      stopRequestedRef.current = false;

      // Local streaming state: progressive aggregation with streams via requestAnimationFrame
      // so that each part does not cause unnecessary re-rendering.
      let streamingMessageId: string | null = null;
      let accumulated = '';
      let flushScheduled = false;
      let finished = false;

      const flushNow = () => {
        if (!streamingMessageId) {
          return;
        }
        const targetId = streamingMessageId;
        const snapshot = accumulated;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === targetId ? { ...message, content: snapshot } : message,
          ),
        );
      };

      const scheduleFlush = () => {
        if (flushScheduled) {
          return;
        }
        flushScheduled = true;
        requestAnimationFrame(() => {
          flushScheduled = false;
          flushNow();
        });
      };

      const ensureStreamingMessage = () => {
        if (streamingMessageId) {
          return;
        }
        streamingMessageId = crypto.randomUUID();
        const newId = streamingMessageId;
        setMessages((previous) => [
          ...previous,
          {
            id: newId,
            role: 'assistant',
            content: '',
            sentAt: new Date().toISOString(),
            status: 'streaming',
          },
        ]);
      };

      const finalizeStreamingMessage = (status: UiMessageStatus | undefined) => {
        if (!streamingMessageId) {
          return;
        }
        flushNow();
        const targetId = streamingMessageId;
        setMessages((previous) =>
          previous.map((message) => (message.id === targetId ? { ...message, status } : message)),
        );
      };

      try {
        await streamTutorChat(
          payload,
          {
            onToken: (text) => {
              accumulated += text;
              ensureStreamingMessage();
              scheduleFlush();
            },
            onDone: ({ keyStatusUpdates }) => {
              finished = true;
              if (keyStatusUpdates.length > 0) {
                applyKeyStatusUpdates(keyStatusUpdates);
              }
              setMessageStatus(userMessageId, undefined);
              finalizeStreamingMessage(undefined);
            },
            onError: (error) => {
              finished = true;
              if (error.keyStatusUpdates.length > 0) {
                applyKeyStatusUpdates(error.keyStatusUpdates);
              }
              if (streamingMessageId) {
                // We keep the partial text and mark the message as incomplete.
                finalizeStreamingMessage('failed');
              } else {
                setMessageStatus(userMessageId, 'failed');
              }
              switch (error.code) {
                case 'SESSION_NOT_FOUND':
                  sessionIdRef.current = null;
                  setChatError({ code: error.code, message: error.message, retryable: true });
                  break;
                case 'SESSION_ENDED':
                  setSessionLock('SESSION_ENDED');
                  break;
                case 'SUBJECT_LOCKED':
                  setNotice(error.message);
                  break;
                case 'NO_API_KEY':
                case 'ALL_KEYS_EXHAUSTED':
                  setChatError({ code: error.code, message: error.message, retryable: false });
                  break;
                default:
                  setChatError({ code: error.code, message: error.message, retryable: error.retryable });
              }
            },
          },
          { signal: controller.signal },
        );

        if (!finished) {
          if (streamingMessageId) {
            if (stopRequestedRef.current) {
              // User stopped: We keep the partial text and consider it a finished response
              // without creating any new message or marking the status as incorrect.
              finalizeStreamingMessage(undefined);
              setMessageStatus(userMessageId, undefined);
            } else {
              // Connection interrupted without a completion event: response is incomplete.
              finalizeStreamingMessage('failed');
            }
          } else if (stopRequestedRef.current) {
            // Stop before any text arrives: no assistant message exists at all.
            setMessageStatus(userMessageId, undefined);
          } else {
            // Stream ended without any text or completion.
            setMessageStatus(userMessageId, 'failed');
            setChatError({
              code: 'NETWORK_ERROR',
              message: 'انقطع الاتصال قبل وصول الرد.',
              retryable: true,
            });
          }
        }
      } catch (error) {
        if (streamingMessageId) {
          finalizeStreamingMessage('failed');
        } else {
          setMessageStatus(userMessageId, 'failed');
        }
        if (error instanceof TutorClientError) {
          setChatError({ code: 'NETWORK_ERROR', message: error.message, retryable: true });
        } else {
          setChatError({
            code: 'NETWORK_ERROR',
            message: 'تعذر إرسال الرسالة. حاول مرة أخرى.',
            retryable: true,
          });
        }
      } finally {
        abortRef.current = null;
        setIsSending(false);
      }
    },
    [resolveSession, setMessageStatus, subject.id],
  );

  const handleSend = useCallback(
    async (content: string) => {
      // Prevent double sending or sending in a locked state.
      if (isSending || sessionLock) {
        return;
      }
      setChatError(null);
      setNotice(null);

      // Pre-send check: no silent attempt without a valid key.
      if (getKeyAccessSnapshot() !== 'READY') {
        return;
      }

      const userMessage: UiChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        sentAt: new Date().toISOString(),
        status: 'sending',
      };
      const history = [...messages, userMessage];
      setMessages(history);
      setIsSending(true);
      await sendConversation(history, userMessage.id);
    },
    [isSending, messages, sendConversation, sessionLock],
  );

  /** Stop the current stream: directly calls AbortController without creating messages. */
  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(async () => {
    if (isSending) {
      return;
    }
    // Retry: We ignore any failed assistant response so it doesn't repeat,
    // and we don't duplicate the student's message that already exists.
    const cleanHistory = messages.filter(
      (message) => !(message.role === 'assistant' && message.status === 'failed'),
    );
    const lastUserMessage = [...cleanHistory].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage) {
      return;
    }
    setChatError(null);
    setNotice(null);
    setMessages(
      cleanHistory.map((message) =>
        message.id === lastUserMessage.id
          ? { ...message, status: 'sending' as const }
          : message,
      ),
    );
    setIsSending(true);
    await sendConversation(cleanHistory, lastUserMessage.id);
  }, [isSending, messages, sendConversation]);

  const handleNewSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionLock(null);
    setChatError(null);
  }, []);

  const keyLocked = lockState !== 'READY';
  const locked = keyLocked || sessionLock !== null;

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
        <div>
          <h1 className="text-sm font-semibold text-foreground">جلسة مادة {subject.nameAr}</h1>
          <p className="text-[11px] text-muted-foreground">كل جلسة مرتبطة بمادة واحدة فقط</p>
        </div>
        <Link
          href="/"
          className="hidden rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60 sm:block"
        >
          تغيير المادة
        </Link>
      </div>

      {notice ? (
        <div className="border-b border-border bg-surface-muted px-4 py-2.5 text-center text-xs leading-5 text-foreground" role="status">
          {notice}
        </div>
      ) : null}

      {chatError && !locked ? (
        <div
          className={`flex flex-wrap items-center justify-center gap-3 border-b px-4 py-2.5 text-center text-xs leading-5 ${
            chatError.retryable
              ? 'border-warning/30 bg-warning/10 text-warning'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
          role="alert"
        >
          <span>{chatError.message}</span>
          {chatError.retryable ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isSending}
              className="rounded-md border border-current px-2.5 py-1 text-[11px] font-semibold hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-50"
            >
              إعادة المحاولة
            </button>
          ) : null}
          {chatError.code === 'INVALID_API_KEY' ? (
            <Link
              href="/settings/api-keys"
              className="rounded-md border border-current px-2.5 py-1 text-[11px] font-semibold hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              مراجعة المفاتيح
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {keyLocked ? (
          <ChatLockState variant={lockState as Extract<ChatLockVariant, 'NO_API_KEY' | 'ALL_KEYS_EXHAUSTED'>} />
        ) : sessionLock === 'SESSION_ENDED' ? (
          <ChatLockState
            variant="SESSION_ENDED"
            action={{ label: 'بدء جلسة جديدة', onClick: handleNewSession }}
          />
        ) : sessionLock === 'SESSION_FAILED' ? (
          <ChatLockState
            variant="SESSION_FAILED"
            action={{ label: 'إعادة المحاولة', onClick: handleNewSession }}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              isThinking={isSending && !messages.some((message) => message.status === 'streaming')}
              subjectName={subject.nameAr}
            />
            <ChatInput
              disabled={isSending}
              onSubmit={handleSend}
              streaming={isSending}
              onStop={handleStop}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Error codes consumed by the interface for general validation — reference for documentation and tests. */
export const HANDLED_TUTOR_ERROR_CODES: readonly TutorErrorCode[] = [
  'NO_API_KEY',
  'ALL_KEYS_EXHAUSTED',
  'INVALID_API_KEY',
  'SUBJECT_LOCKED',
  'SESSION_NOT_FOUND',
  'SESSION_ENDED',
  'INVALID_SUBJECT',
  'VALIDATION_ERROR',
  'NETWORK_ERROR',
  'PROVIDER_UNKNOWN',
  'INTERNAL_ERROR',
];
