'use client';
import { useTransition } from 'react';
import { resetAll } from './actions.ts';

type Counts = { goals: number; cards: number; assigned: number; started: number };

export function ResetButton({ adminKey, counts }: { adminKey: string; counts: Counts }) {
  const [pending, start] = useTransition();
  const onClick = () => {
    const summary = `득점 ${counts.goals}건, 카드 ${counts.cards}건, 추첨 배정 ${counts.assigned}개, 진행된 경기 ${counts.started}개`;
    if (!confirm(`${summary}를 모두 지울까요?\n팀·선수·시간표는 유지됩니다.`)) return;
    // 2차: 직접 입력해야 실행(연속 탭으로 지워지는 것 방지)
    if (prompt('되돌릴 수 없습니다. 정말 초기화하려면 "초기화"라고 입력하세요.')?.trim() !== '초기화') return alert('취소했습니다.');
    start(async () => {
      try {
        await resetAll(adminKey, 'RESET');
        alert('초기화했습니다.');
      } catch (e) {
        alert(`초기화 실패: ${e instanceof Error ? e.message : e}`);
      }
    });
  };
  return (
    <button
      className="mt-8 w-full rounded-xl border-2 border-red-600 p-4 font-semibold text-red-600 disabled:opacity-40"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? '초기화 중…' : '⚠ 대회 데이터 초기화'}
    </button>
  );
}
