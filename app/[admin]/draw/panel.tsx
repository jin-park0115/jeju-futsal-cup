'use client';
import { useTransition } from 'react';
import { assignSlot, randomDraw } from '../actions.ts';

type Props = {
  adminKey: string;
  division: 'middle' | 'high';
  slots: { id: number; group: string; label: string; team_id: number | null }[];
  teams: { id: number; name: string }[];
};

export function DrawPanel({ adminKey, division, slots, teams }: Props) {
  const [pending, start] = useTransition();
  const used = new Set(slots.map((s) => s.team_id));
  const empty = slots.filter((s) => s.team_id === null).length;
  const draw = (all: boolean) =>
    start(async () => {
      try {
        const msg = await randomDraw(adminKey, division, all);
        if (msg) alert(msg);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <div className={`rounded-xl bg-white p-3 shadow-sm ${pending ? 'opacity-60' : ''}`}>
      <ul className="divide-y divide-slate-100">
        {slots.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-20 shrink-0 font-semibold">{s.label}</span>
            <select
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2"
              value={s.team_id ?? ''}
              disabled={pending}
              onChange={(e) => start(() => assignSlot(adminKey, s.id, e.target.value ? Number(e.target.value) : null))}
            >
              <option value="">— 미배정 —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={used.has(t.id) && t.id !== s.team_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
          disabled={pending || empty === 0}
          onClick={() => confirm(`빈 슬롯 ${empty}개에 남은 팀을 무작위로 배정할까요?`) && draw(false)}
        >
          🎲 빈 슬롯 채우기
        </button>
        <button
          className="rounded-lg border border-slate-900 py-3 font-semibold disabled:opacity-40"
          disabled={pending}
          onClick={() => confirm('현재 배정을 모두 지우고 처음부터 다시 뽑을까요?') && draw(true)}
        >
          🔄 전체 다시 뽑기
        </button>
      </div>
    </div>
  );
}
