import { loadDivision, parseDivision } from '@/lib/data.ts';
import type { Standings } from '@/lib/standings.ts';
import { Header, MatchCard } from './ui.tsx';

export default async function Home({ searchParams }: PageProps<'/'>) {
  const d = await loadDivision(parseDivision((await searchParams).d));
  const knockout = (['third', 'final'] as const).map((stage) => d.views.find((v) => v.match.stage === stage)!);

  return (
    <>
      <Header division={d.division} path="/" />

      {d.podium && (
        <section className="mt-2 rounded-xl bg-gradient-to-br from-amber-100 to-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">최종 순위</h2>
          <ol className="space-y-1 text-lg">
            {d.podium.map((name, i) => (
              <li key={i}>
                {['🥇', '🥈', '🥉'][i]} <b>{name}</b>
              </li>
            ))}
          </ol>
        </section>
      )}

      {d.groups.map((g) => (
        <section key={g} className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{g}조</h2>
          <StandingsTable s={d.standings[g]} slotLabel={d.slotLabel} />
          <div className="mt-3 space-y-2">
            {d.views
              .filter((v) => v.match.stage === 'group' && v.match.group === g)
              .map((v) => (
                <MatchCard key={v.match.id} v={v} playerName={d.playerName} />
              ))}
          </div>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold">토너먼트</h2>
        <div className="space-y-2">
          <MatchCard v={knockout[1]} playerName={d.playerName} title="결승" />
          <MatchCard v={knockout[0]} playerName={d.playerName} title="3·4위전" />
        </div>
      </section>
    </>
  );
}

function StandingsTable({ s, slotLabel }: { s: Standings; slotLabel: (slot: Standings['rows'][number]['slot']) => string }) {
  const cols = ['경기', '승', '무', '패', '득', '실', '득실', '승점', '매너'];
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-center text-sm tabular-nums">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="py-2 pl-3 text-left" colSpan={2}>
              팀
            </th>
            {cols.map((c) => (
              <th key={c} className="px-1 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.slot.id} className={`border-t border-slate-100 ${r.rank <= 2 && s.complete && !r.tied ? 'bg-emerald-50' : ''}`}>
              <td className="w-6 py-2 pl-3 text-slate-500" title={r.tied ? '완전 동률: 운영진 지정 필요' : undefined}>
                {r.rank}
                {r.tied && '='}
              </td>
              <td className="max-w-28 truncate pl-1 text-left font-semibold">{slotLabel(r.slot)}</td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>{r.goalsFor}</td>
              <td>{r.goalsAgainst}</td>
              <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="font-bold">{r.points}</td>
              <td className={`pr-3 ${r.manner < 0 ? 'text-red-600' : ''}`}>{r.manner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
