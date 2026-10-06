'use client';
import { useTransition } from 'react';
import { setManualTeam } from '../actions.ts';

type Props = {
  adminKey: string;
  matchId: number;
  side: 'home' | 'away';
  value: number | null;
  teams: { id: number; name: string }[];
};

export function ManualSelect({ adminKey, matchId, side, value, teams }: Props) {
  const [pending, start] = useTransition();
  return (
    <select
      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 disabled:opacity-50"
      value={value ?? ''}
      disabled={pending}
      onChange={(e) => start(() => setManualTeam(adminKey, matchId, side, e.target.value ? Number(e.target.value) : null))}
    >
      <option value="">자동</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
