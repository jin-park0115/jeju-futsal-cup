import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDivision, matchDivision } from '@/lib/data.ts';
import { MatchCard } from '../../ui.tsx';

const CARD_LABEL = { yellow: '🟨 경고', second_yellow: '🟨🟥 경고누적 퇴장', red: '🟥 퇴장' } as const;

export default async function MatchPage({ params }: PageProps<'/match/[id]'>) {
  const id = Number((await params).id);
  const division = Number.isInteger(id) ? await matchDivision(id) : null;
  if (!division) notFound();
  const d = await loadDivision(division);
  const v = d.views.find((x) => x.match.id === id)!;

  const timeline = [
    ...v.goals.map((g) => ({
      key: `g${g.id}`,
      minute: g.minute,
      at: g.created_at,
      home: g.scoring_team_id === v.home,
      text: `⚽ ${d.playerName.get(g.player_id)}${g.own_goal ? ' (자책골)' : ''}`,
    })),
    ...v.cards.map((c) => ({
      key: `c${c.id}`,
      minute: c.minute,
      at: c.created_at,
      home: c.team_id === v.home,
      text: `${CARD_LABEL[c.type]} ${d.playerName.get(c.player_id)}`,
    })),
  ].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.at.localeCompare(b.at));

  return (
    <>
      <div className="pt-4 pb-3">
        <Link href={`/?d=${division}`} className="text-sm text-slate-500">
          ← 경기·순위
        </Link>
      </div>
      <MatchCard v={v} playerName={d.playerName} />
      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">타임라인</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">기록이 없습니다.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {timeline.map((e) => (
              <li key={e.key} className={`flex gap-3 ${e.home ? '' : 'flex-row-reverse text-right'}`}>
                <span className="w-8 shrink-0 text-center text-slate-400 tabular-nums">{e.minute !== null ? `${e.minute}'` : ''}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
