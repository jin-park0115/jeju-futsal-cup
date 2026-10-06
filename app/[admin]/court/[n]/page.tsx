import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDivision, DIVISION_LABEL } from '@/lib/data.ts';
import { suspendedPlayers } from '@/lib/standings.ts';
import { CourtPanel, type Event } from './panel.tsx';

const STAGE = { group: '조별', third: '3·4위전', final: '결승' } as const;
const STATUS = { scheduled: '예정', live: '진행중', finished: '종료' } as const;
const CARD = { yellow: '🟨 경고', second_yellow: '🟨🟥 경고누적 퇴장', red: '🟥 퇴장' } as const;

export default async function CourtPage({ params, searchParams }: PageProps<'/[admin]/court/[n]'>) {
  const { admin, n } = await params;
  const court = Number(n);
  if (![1, 2, 3, 4].includes(court)) notFound();
  const pick = Number((await searchParams).m);

  const divisions = await Promise.all((['high', 'middle'] as const).map(loadDivision));
  const list = divisions
    .flatMap((d) => d.views.filter((v) => v.match.court === court).map((v) => ({ d, v })))
    .sort((a, b) => a.v.match.start_time.localeCompare(b.v.match.start_time));
  const current =
    list.find((x) => x.v.match.id === pick) ??
    list.find((x) => x.v.match.status === 'live') ??
    list.find((x) => x.v.match.status === 'scheduled') ??
    list.at(-1);

  const nav = (
    <ul className="mt-6 divide-y divide-slate-100 rounded-xl bg-white text-sm shadow-sm">
      {list.map(({ d, v }) => (
        <li key={v.match.id}>
          <Link
            href={`/${admin}/court/${court}?m=${v.match.id}`}
            className={`flex gap-2 px-3 py-2.5 ${v.match.id === current?.v.match.id ? 'bg-amber-50 font-semibold' : ''}`}
          >
            <span className="text-slate-500">{v.match.start_time.slice(0, 5)}</span>
            <span className="min-w-0 flex-1 truncate">
              {DIVISION_LABEL[d.division]} {v.match.stage === 'group' ? d.groupLabel(v.match.group) : STAGE[v.match.stage]} · {v.homeLabel} vs {v.awayLabel}
            </span>
            <span className="text-slate-500">
              {v.score ? `${v.score[0]}:${v.score[1]} ` : ''}
              {STATUS[v.match.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  if (!current) return <p className="py-10 text-center text-slate-500">이 구장에 배정된 경기가 없습니다.</p>;
  const { d, v } = current;

  const fixtures = d.views.map((x) => ({ id: x.match.id, start_time: x.match.start_time, home: x.home, away: x.away }));
  const banned = suspendedPlayers(fixtures.find((f) => f.id === v.match.id)!, fixtures, d.cards, d.players);
  const roster = (team: number | null) =>
    d.players
      .filter((p) => p.team_id === team)
      .map((p) => ({ id: p.id, name: p.name, suspended: banned.has(p.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const events: Event[] = [
    ...v.goals.map((g) => ({
      kind: 'goal' as const,
      id: g.id,
      minute: g.minute,
      at: g.created_at,
      home: g.scoring_team_id === v.home,
      text: `⚽ ${d.playerName.get(g.player_id)}${g.own_goal ? ' (자책골)' : ''}`,
    })),
    ...v.cards.map((c) => ({
      kind: 'card' as const,
      id: c.id,
      minute: c.minute,
      at: c.created_at,
      home: c.team_id === v.home,
      text: `${CARD[c.type]} ${d.playerName.get(c.player_id)}`,
    })),
  ].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.at.localeCompare(b.at));

  return (
    <>
      <CourtPanel
        key={v.match.id}
        adminKey={admin}
        title={`${court}구장 · ${v.match.start_time.slice(0, 5)} · ${DIVISION_LABEL[d.division]} ${v.match.stage === 'group' ? d.groupLabel(v.match.group) : STAGE[v.match.stage]}`}
        match={{ id: v.match.id, status: v.match.status, knockout: v.match.stage !== 'group', home_pk: v.match.home_pk, away_pk: v.match.away_pk }}
        home={{ team: v.home, label: v.homeLabel, players: roster(v.home) }}
        away={{ team: v.away, label: v.awayLabel, players: roster(v.away) }}
        score={v.score ?? [0, 0]}
        events={events}
      />
      {nav}
    </>
  );
}
