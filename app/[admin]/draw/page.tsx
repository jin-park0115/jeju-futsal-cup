import { DIVISION_LABEL, loadDivision } from '@/lib/data.ts';
import { DrawPanel } from './panel.tsx';

export default async function DrawPage({ params }: PageProps<'/[admin]/draw'>) {
  const { admin } = await params;
  const divisions = await Promise.all((['high', 'middle'] as const).map(loadDivision));
  return (
    <div className="space-y-6">
      {divisions.map((d) => (
        <section key={d.division}>
          <h2 className="mb-2 text-lg font-bold">{DIVISION_LABEL[d.division]}</h2>
          <DrawPanel
            adminKey={admin}
            division={d.division}
            slots={d.slots.map((s) => ({ id: s.id, group: s.group, label: `${d.division === 'high' ? '고등' : '중등'}${s.number}`, team_id: s.team_id }))}
            teams={d.teams.sort((a, b) => a.name.localeCompare(b.name, 'ko'))}
          />
        </section>
      ))}
    </div>
  );
}
