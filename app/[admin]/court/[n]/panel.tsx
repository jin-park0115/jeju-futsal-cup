'use client';
import { useState, useTransition } from 'react';
import { addCard, addGoal, addPlayer, deleteEvent, finishMatch, setEventMinute, startMatch } from '../../actions.ts';

type Player = { id: number; name: string; suspended: boolean };
type Side = { team: number | null; label: string; players: Player[] };
export type Event = { kind: 'goal' | 'card'; id: number; minute: number | null; at: string; home: boolean; text: string };
type Props = {
  adminKey: string;
  title: string;
  match: { id: number; status: 'scheduled' | 'live' | 'finished'; knockout: boolean; home_pk: number | null; away_pk: number | null };
  home: Side;
  away: Side;
  score: number[];
  events: Event[];
};
type Step = null | { kind: 'goal' | 'card'; side?: 'home' | 'away'; player?: Player };

const big = 'rounded-xl py-4 text-lg font-bold disabled:opacity-40';

export function CourtPanel({ adminKey: key, title, match, home, away, score, events }: Props) {
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>(null);
  const [pk, setPk] = useState([match.home_pk?.toString() ?? '', match.away_pk?.toString() ?? '']);
  // keepStep: 선수 추가처럼 입력 단계를 유지해야 하는 경우
  const act = (fn: () => Promise<void>, keepStep = false) =>
    start(async () => {
      try {
        await fn();
        if (!keepStep) setStep(null);
      } catch (e) {
        alert(`저장 실패: ${e instanceof Error ? e.message : e}`);
      }
    });

  const sides = { home, away };
  const newPlayer = (team: number | null) => {
    const name = team && prompt('추가할 선수 이름')?.trim();
    if (name) act(() => addPlayer(key, team, name), true);
  };
  const tied = score[0] === score[1];
  const needPk = match.knockout && tied;
  const pkValid = !needPk || (pk.every((x) => /^\d+$/.test(x)) && pk[0] !== pk[1]);
  const pkValue = needPk ? (pk.map(Number) as [number, number]) : null;

  return (
    <div className={pending ? 'pointer-events-none opacity-60' : ''}>
      <p className="text-sm text-slate-500">{title}</p>
      <div className="my-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
        <span className="truncate text-right text-lg font-bold">{home.label}</span>
        <span className="text-4xl font-black tabular-nums">
          {score[0]}:{score[1]}
        </span>
        <span className="truncate text-lg font-bold">{away.label}</span>
        {match.home_pk !== null && <span className="col-span-3 text-center text-sm text-slate-500">승부차기 {match.home_pk}:{match.away_pk}</span>}
      </div>

      {match.status === 'scheduled' &&
        (home.team && away.team ? (
          <button className={`${big} w-full bg-emerald-600 text-white`} onClick={() => act(() => startMatch(key, match.id, home.team!, away.team!))}>
            ▶ 경기 시작
          </button>
        ) : (
          <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-800">대진 미확정입니다. 추첨 또는 대진 페이지에서 팀을 정해 주세요.</p>
        ))}

      {match.status !== 'scheduled' && (
        <>
          {match.status === 'finished' && <p className="mb-2 rounded-lg bg-slate-200 p-2 text-center text-sm">종료된 경기 · 기록 수정 가능</p>}

          {step === null && (
            <div className="grid grid-cols-2 gap-2">
              <button className={`${big} bg-white shadow-sm`} onClick={() => setStep({ kind: 'goal' })}>
                ⚽ 득점
              </button>
              <button className={`${big} bg-white shadow-sm`} onClick={() => setStep({ kind: 'card' })}>
                🟨🟥 카드
              </button>
            </div>
          )}

          {step && (
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <b>{step.kind === 'goal' ? '⚽ 득점' : '🟨🟥 카드'}</b>
                <button className="px-2 py-1 text-slate-500" onClick={() => setStep(null)}>
                  취소
                </button>
              </div>

              {!step.side && (
                <div className="grid grid-cols-2 gap-2">
                  {(['home', 'away'] as const).map((s) => (
                    <button key={s} className={`${big} truncate bg-slate-100 px-2`} onClick={() => setStep({ ...step, side: s })}>
                      {sides[s].label}
                    </button>
                  ))}
                </div>
              )}

              {step.side && step.kind === 'goal' && (
                <GoalPicker
                  scorer={sides[step.side]}
                  opponent={sides[step.side === 'home' ? 'away' : 'home']}
                  onPick={(p, own) => act(() => addGoal(key, match.id, p.id, sides[step.side!].team!, own))}
                  onAdd={newPlayer}
                />
              )}

              {step.side && step.kind === 'card' && !step.player && (
                <PlayerGrid players={sides[step.side].players} onPick={(p) => setStep({ ...step, player: p })} onAdd={() => newPlayer(sides[step.side!].team)} />
              )}

              {step.player && (
                <div>
                  <p className="mb-2 text-center text-lg font-semibold">{step.player.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={`${big} bg-yellow-300`} onClick={() => act(() => addCard(key, match.id, step.player!.id, 'yellow'))}>
                      🟨 경고
                    </button>
                    <button className={`${big} bg-red-600 text-white`} onClick={() => act(() => addCard(key, match.id, step.player!.id, 'red'))}>
                      🟥 퇴장
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">같은 경기 두 번째 경고는 자동으로 경고누적 퇴장 처리</p>
                </div>
              )}
            </div>
          )}

          <ul className="mt-4 divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
            {events.length === 0 && <li className="p-3 text-center text-sm text-slate-500">기록 없음</li>}
            {events.map((e) => (
              <li key={`${e.kind}${e.id}`} className="flex items-center gap-2 px-3 py-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  defaultValue={e.minute ?? ''}
                  aria-label="분"
                  className="w-12 rounded border border-slate-300 px-1 py-1 text-center"
                  onBlur={(ev) => {
                    const v = ev.target.value === '' ? null : Number(ev.target.value);
                    if (v !== e.minute) act(() => setEventMinute(key, e.kind, e.id, v));
                  }}
                />
                <span className="text-xs text-slate-400">&apos;</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="mr-1 text-xs text-slate-400">{e.home ? home.label : away.label}</span>
                  {e.text}
                </span>
                <button
                  className="rounded px-2 py-1 text-sm text-red-600"
                  onClick={() => confirm(`삭제할까요? ${e.text}`) && act(() => deleteEvent(key, e.kind, e.id))}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          {needPk && (
            <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-center font-semibold">동점 → 승부차기 스코어</p>
              <div className="flex items-center justify-center gap-2">
                {[0, 1].map((i) => (
                  <input
                    key={i}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={pk[i]}
                    onChange={(ev) => setPk(i === 0 ? [ev.target.value, pk[1]] : [pk[0], ev.target.value])}
                    aria-label={i === 0 ? home.label : away.label}
                    className="w-20 rounded-lg border border-slate-300 py-2 text-center text-2xl"
                  />
                ))}
              </div>
            </div>
          )}

          {(match.status === 'live' || needPk) && (
            <button
              className={`${big} mt-4 w-full bg-slate-900 text-white`}
              disabled={!pkValid}
              onClick={() => confirm(match.status === 'live' ? '경기를 종료할까요?' : '승부차기 스코어를 저장할까요?') && act(() => finishMatch(key, match.id, pkValue))}
            >
              {match.status === 'live' ? '■ 경기 종료' : '승부차기 저장'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PlayerGrid({ players, onPick, onAdd, tone = 'bg-slate-100' }: { players: Player[]; onPick: (p: Player) => void; onAdd: () => void; tone?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => (
        <button key={p.id} className={`rounded-lg px-2 py-3 font-semibold ${tone} ${p.suspended ? 'ring-2 ring-red-500' : ''}`} onClick={() => onPick(p)}>
          {p.name}
          {p.suspended && <span className="block text-xs font-normal text-red-600">출장정지</span>}
        </button>
      ))}
      <button className="rounded-lg border-2 border-dashed border-slate-300 px-2 py-3 text-slate-500" onClick={onAdd}>
        + 선수 추가
      </button>
    </div>
  );
}

function GoalPicker({ scorer, opponent, onPick, onAdd }: { scorer: Side; opponent: Side; onPick: (p: Player, own: boolean) => void; onAdd: (team: number | null) => void }) {
  const [own, setOwn] = useState(false);
  return (
    <>
      <PlayerGrid players={scorer.players} onPick={(p) => onPick(p, false)} onAdd={() => onAdd(scorer.team)} />
      <button className="mt-3 w-full py-2 text-sm text-slate-500 underline" onClick={() => setOwn(!own)}>
        {own ? '자책골 닫기' : `상대(${opponent.label}) 자책골`}
      </button>
      {own && <PlayerGrid players={opponent.players} tone="bg-orange-100" onPick={(p) => onPick(p, true)} onAdd={() => onAdd(opponent.team)} />}
    </>
  );
}
