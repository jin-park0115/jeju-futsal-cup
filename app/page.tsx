import { loadDivision, parseDivision } from '@/lib/data.ts';
import { Header, MatchCard, StandingsTable } from './ui.tsx';

export default async function Home({ searchParams }: PageProps<'/'>) {
  const d = await loadDivision(parseDivision((await searchParams).d));
  // 결승 먼저. 토너먼트가 없는 부문(중등부 4팀 리그)은 비어 있다
  const knockout = (['final', 'third'] as const).flatMap((stage) => d.views.filter((v) => v.match.stage === stage));

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
          <h2 className="mb-2 text-lg font-bold">{d.groupLabel(g)}</h2>
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

      {knockout.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">토너먼트</h2>
          <div className="space-y-2">
            {knockout.map((v) => (
              <MatchCard key={v.match.id} v={v} playerName={d.playerName} title={v.match.stage === 'final' ? '결승' : '3·4위전'} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
