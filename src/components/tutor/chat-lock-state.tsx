/**
 * Chat lock states: no sending is happening in any of them.
 * - No keys / All keys exhausted → Redirect to keys page.
 * - Session ended or session loading failed → Start new session or retry.
 * - Unknown subject is handled at the page level (404) before reaching here.
 */

'use client';

import Link from 'next/link';

export type ChatLockVariant =
  | 'NO_API_KEY'
  | 'ALL_KEYS_EXHAUSTED'
  | 'SESSION_ENDED'
  | 'SESSION_FAILED';

interface ChatLockCopy {
  title: string;
  description: string;
}

const COPY: Record<ChatLockVariant, ChatLockCopy> = {
  NO_API_KEY: {
    title: 'لا يوجد مفتاح للبدء',
    description:
      'لكي تتحدث مع المدرّس، أضف أولًا مفتاح مزود ذكاء اصطناعي خاصًا بك. لن يُرسَل أي طلب قبل توفر مفتاح صالح.',
  },
  ALL_KEYS_EXHAUSTED: {
    title: 'كل المفاتيح غير صالحة أو مستنفدة',
    description:
      'استنفدت حصة المفاتيح المحفوظة أو أصبحت غير صالحة. حدّث حالة مفتاح أو أضف مفتاحًا جديدًا للمتابعة.',
  },
  SESSION_ENDED: {
    title: 'انتهت هذه الجلسة',
    description:
      'لا يمكن إرسال رسائل في جلسة منتهية، ولا يمكن تغيير مادة الجلسة الحالية. ابدأ جلسة جديدة للمتابعة.',
  },
  SESSION_FAILED: {
    title: 'تعذر تحميل الجلسة',
    description: 'حدثت مشكلة أثناء تجهيز الجلسة. أعد المحاولة، ولن تُرسَل أي رسالة قبل نجاح ذلك.',
  },
};

export interface ChatLockAction {
  label: string;
  onClick: () => void;
}

interface ChatLockStateProps {
  variant: ChatLockVariant;
  /** Optional action (e.g., start new session or retry). */
  action?: ChatLockAction;
}

export function ChatLockState({ variant, action }: ChatLockStateProps) {
  const copy = COPY[variant];
  const isKeyLock = variant === 'NO_API_KEY' || variant === 'ALL_KEYS_EXHAUSTED';

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-warning/40 bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/40 bg-warning/10 text-warning">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
            <rect x="5" y="10" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-foreground">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>

        <div className="mt-5 flex flex-col items-center gap-2">
          {isKeyLock ? (
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              إدارة المفاتيح
            </Link>
          ) : null}
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring/60"
            >
              {action.label}
            </button>
          ) : null}
        </div>

        {isKeyLock ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            تُخزَّن المفاتيح محليًا في المتصفح في هذه المرحلة التطويرية فقط.
          </p>
        ) : null}
      </div>
    </div>
  );
}
