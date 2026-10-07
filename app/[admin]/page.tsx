import Link from 'next/link';
import { COURTS } from '@/lib/data.ts';

export default async function AdminHome({ params }: PageProps<'/[admin]'>) {
  const { admin } = await params;
  const links = [
    ['draw', '🎲 추첨 배정'],
    ...COURTS.map((n) => [`court/${n}`, `${n}구장 입력`]),
    ['bracket', '🏆 토너먼트 대진'],
    ['teams', '👥 팀·선수 관리'],
  ];
  return (
    <div className="grid gap-2 pt-2">
      {links.map(([href, label]) => (
        <Link key={href} href={`/${admin}/${href}`} className="rounded-xl bg-white p-4 text-lg font-semibold shadow-sm active:bg-slate-50">
          {label}
        </Link>
      ))}
    </div>
  );
}
