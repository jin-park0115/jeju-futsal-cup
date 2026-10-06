import { loadDivision, parseDivision } from '@/lib/data.ts';
import { topScorers } from '@/lib/standings.ts';
import { Header } from '../ui.tsx';

export const metadata = { title: '득점왕 · 제주 풋살컵' };

export default async function Scorers({ searchParams }: PageProps<'/scorers'>) {
  const d = await loadDivision(parseDivision((await searchParams).d));
  const playerTeam = new Map(d.goals.map((g) => [g.player_id, g.scoring_team_id]));
  const list = topScorers(d.goals);

  return (
    <>
      <Header division={d.division} path="/scorers" />
      {list.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">아직 득점 기록이 없습니다.</p>
      ) : (
        <table className="mt-2 w-full overflow-hidden rounded-xl bg-white text-sm shadow-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-12 py-2">순위</th>
              <th className="text-left">선수</th>
              <th className="text-left">팀</th>
              <th className="w-14 pr-3 text-right">골</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.player_id} className="border-t border-slate-100">
                <td className="py-2 text-center text-slate-500">{s.rank}</td>
                <td className="font-semibold">{d.playerName.get(s.player_id)}</td>
                <td className="text-slate-600">{d.teamName.get(playerTeam.get(s.player_id)!)}</td>
                <td className="pr-3 text-right font-bold tabular-nums">{s.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
