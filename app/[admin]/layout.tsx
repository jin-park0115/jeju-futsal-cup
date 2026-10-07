import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COURTS } from '@/lib/data.ts';

export const metadata = { title: '운영진 · 제주 풋살컵', robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: LayoutProps<'/[admin]'>) {
  const { admin } = await params;
  if (!process.env.ADMIN_PATH || admin !== process.env.ADMIN_PATH) notFound();
  return (
    <>
      <nav className="sticky top-0 z-10 -mx-4 mb-3 flex gap-1 overflow-x-auto bg-slate-900 px-4 py-2 text-sm text-white">
        <Link href={`/${admin}/draw`} className="rounded px-2 py-1 hover:bg-slate-700">
          추첨
        </Link>
        {COURTS.map((n) => (
          <Link key={n} href={`/${admin}/court/${n}`} className="rounded px-2 py-1 hover:bg-slate-700">
            {n}구장
          </Link>
        ))}
        <Link href={`/${admin}/bracket`} className="rounded px-2 py-1 hover:bg-slate-700">
          대진
        </Link>
        <Link href="/" className="ml-auto rounded px-2 py-1 text-slate-400">
          공개화면
        </Link>
      </nav>
      {children}
    </>
  );
}
