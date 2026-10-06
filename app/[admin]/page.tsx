import Link from 'next/link';

export default async function AdminHome({ params }: PageProps<'/[admin]'>) {
  const { admin } = await params;
  const links = [
    ['draw', '🎲 추첨 배정'],
    ['court/1', '1구장 입력'],
    ['court/2', '2구장 입력'],
    ['court/3', '3구장 입력'],
    ['court/4', '4구장 입력'],
    ['bracket', '🏆 토너먼트 대진'],
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
