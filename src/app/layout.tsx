import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
import { THEME_STORAGE_KEY } from '@/lib/theme/theme-mode';
import './globals.css';

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Orixios — مدرّسك الذكي',
  description:
    'Orixios منصة تعليمية مع مدرّس ذكي يشرح بالاعتماد على مصادر موثوقة. المرحلة الحالية: أساس شات المدرّس.',
};

/**
 * سكربت يطبّق الثيم المحفوظ قبل أول رسم لمنع وميض الثيم الخطأ.
 * الافتراضي عند غياب الاختيار: الوضع الداكن.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var m=(s==='light'||s==='system')?s:'dark';var d=(m==='dark')||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabicFont.className} dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
