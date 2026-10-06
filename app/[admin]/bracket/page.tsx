import { DIVISION_LABEL, loadDivision } from '@/lib/data.ts';
import { resolveSource, sourceLabel } from '@/lib/standings.ts';
import { StandingsTable } from '../../ui.tsx';
import { ManualSelect } from './select.tsx';

const STAGE = { third: '3·4위전', final: '결승' } as const;

export default async function BracketPage({ params }: PageProps<'/[admin]/bracket'>) {
  const { admin } = await params;
  const divisions = await Promise.all((['high', 'middle'] as const).map(loadDivision));

  return (
    <div className="space-y-8">
      {divisions.map((d) => (
        <section key={d.division}>
          <h2 className="mb-2 text-lg font-bold">{DIVISION_LABEL[d.division]}</h2>
          {d.groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="mb-1 text-sm font-semibold">
                {g}조 {d.standings[g].complete ? '· 경기 종료' : '· 진행 중'}
                {d.standings[g].rows.some((r) => r.tied) && <span className="ml-1 text-red-600">· 동률 있음(직접 지정 필요)</span>}
              </p>
              <StandingsTable s={d.standings[g]} slotLabel={d.slotLabel} />
            </div>
          ))}

          {d.views
            .filter((v) => v.match.stage !== 'group')
            .map((v) => {
              const m = v.match;
              const sides = [
                { side: 'home' as const, source: m.home_source!, manual: m.manual_home_team_id },
                { side: 'away' as const, source: m.away_source!, manual: m.manual_away_team_id },
              ];
              return (
                <div key={m.id} className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                  <p className="mb-2 font-semibold">
                    {STAGE[m.stage as 'third' | 'final']} <span className="text-sm font-normal text-slate-500">{m.start_time.slice(0, 5)} · {m.court}구장</span>
                    {m.status !== 'scheduled' && <span className="ml-1 text-xs text-amber-700">(시작됨: 대진 고정)</span>}
                  </p>
                  {sides.map((s) => {
                    const auto = resolveSource(s.source, null, d.standings);
                    return (
                      <div key={s.side} className="flex items-center gap-2 py-1 text-sm">
                        <span className="w-16 shrink-0 text-slate-500">{sourceLabel(s.source)}</span>
                        <span className="w-24 shrink-0 truncate">{auto ? d.teamName.get(auto) : '미확정'}</span>
                        <ManualSelect
                          adminKey={admin}
                          matchId={m.id}
                          side={s.side}
                          value={s.manual}
                          teams={d.teams}
                        />
                      </div>
                    );
                  })}
                  <p className="mt-1 text-xs text-slate-400">왼쪽은 자동 계산, 오른쪽에서 직접 지정하면 그 팀이 우선합니다.</p>
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}
