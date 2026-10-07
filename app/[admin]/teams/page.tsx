import { DIVISION_LABEL, loadDivision } from '@/lib/data.ts';
import { TeamsPanel } from './panel.tsx';

export default async function TeamsPage({ params }: PageProps<'/[admin]/teams'>) {
  const { admin } = await params;
  const divisions = await Promise.all((['high', 'middle'] as const).map(loadDivision));
  return (
    <div className="space-y-8">
      {divisions.map((d) => (
        <section key={d.division}>
          <h2 className="mb-2 text-lg font-bold">
            {DIVISION_LABEL[d.division]} <span className="text-sm font-normal text-slate-500">{d.teams.length}팀</span>
          </h2>
          <TeamsPanel
            adminKey={admin}
            division={d.division}
            teams={d.teams
              .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
              .map((t) => ({ ...t, players: d.players.filter((p) => p.team_id === t.id).map((p) => ({ id: p.id, name: p.name })) }))}
          />
        </section>
      ))}
    </div>
  );
}
