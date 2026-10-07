'use client';
import { useTransition } from 'react';
import { addPlayer, addTeam, deletePlayer, renamePlayer, renameTeam } from '../actions.ts';

type Team = { id: number; name: string; players: { id: number; name: string }[] };
type Props = { adminKey: string; division: 'middle' | 'high'; teams: Team[] };

const input = 'min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2';

export function TeamsPanel({ adminKey: key, division, teams }: Props) {
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<string | void>) =>
    start(async () => {
      try {
        const msg = await fn();
        if (msg) alert(msg);
      } catch (e) {
        alert(`저장 실패: ${e instanceof Error ? e.message : e}`);
      }
    });
  // 입력칸에서 포커스가 빠질 때 값이 바뀌었으면 저장
  const onRename = (before: string, save: (name: string) => Promise<string | void>) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (!v) e.target.value = before;
    else if (v !== before) act(() => save(v));
  };
  const onAdd = (save: (name: string) => Promise<string | void>) => (form: FormData) => {
    const v = String(form.get('name') ?? '').trim();
    if (v) act(() => save(v));
  };

  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      {teams.map((t) => (
        <div key={t.id} className="rounded-xl bg-white p-3 shadow-sm">
          <input
            key={t.name}
            defaultValue={t.name}
            aria-label="팀 이름"
            className={`${input} w-full text-lg font-bold`}
            onBlur={onRename(t.name, (name) => renameTeam(key, t.id, name))}
          />
          <ul className="mt-2 space-y-1">
            {t.players.length === 0 && <li className="text-sm text-slate-500">선수 없음</li>}
            {t.players.map((p) => (
              <li key={p.id} className="flex gap-2">
                <input
                  key={p.name}
                  defaultValue={p.name}
                  aria-label="선수 이름"
                  className={input}
                  onBlur={onRename(p.name, (name) => renamePlayer(key, p.id, name))}
                />
                <button className="px-2 text-sm text-red-600" onClick={() => confirm(`${p.name} 선수를 삭제할까요?`) && act(() => deletePlayer(key, p.id))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <form action={onAdd((name) => addPlayer(key, t.id, name))} className="mt-2 flex gap-2">
            <input name="name" placeholder="선수 이름" maxLength={30} className={input} />
            <button className="rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">+ 선수</button>
          </form>
        </div>
      ))}
      <form action={onAdd((name) => addTeam(key, division, name))} className="flex gap-2 rounded-xl border-2 border-dashed border-slate-300 p-3">
        <input name="name" placeholder="새 팀 이름" maxLength={30} className={input} />
        <button className="rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">+ 팀 추가</button>
      </form>
    </div>
  );
}
