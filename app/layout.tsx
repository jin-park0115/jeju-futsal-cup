import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '제주 풋살컵',
  description: '제주 with us 풋살 대회 실시간 결과',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-slate-100 text-slate-900 antialiased">
        <main className="mx-auto max-w-xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
