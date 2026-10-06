import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStandings,
  resolveSource,
  sourceLabel,
  suspendedPlayers,
  topScorers,
  type Card,
  type Goal,
  type Match,
  type Player,
  type Slot,
} from './standings.ts';

// 슬롯 n → 팀 100+n, 각 팀 선수 (100+n)*10+1, +2
const slots = (...ns: number[]): Slot[] => ns.map((n) => ({ id: n, number: n, group: 'A', team_id: 100 + n }));
const players: Player[] = [1, 2, 3, 4].flatMap((n) => [1, 2].map((k) => ({ id: (100 + n) * 10 + k, team_id: 100 + n })));
const p = (slot: number, k = 1) => (100 + slot) * 10 + k;

let nextId = 1;
type Built = { matches: Match[]; goals: Goal[] };
/** [홈슬롯, 원정슬롯, 홈골, 원정골, 종료여부] */
function play(...games: [number, number, number, number, boolean?][]): Built {
  const out: Built = { matches: [], goals: [] };
  for (const [h, a, hs, as, done = true] of games) {
    const id = nextId++;
    out.matches.push({ id, stage: 'group', group: 'A', start_time: `10:${String(id).padStart(2, '0')}`, status: done ? 'finished' : 'scheduled', home_slot_id: h, away_slot_id: a });
    for (let i = 0; i < hs; i++) out.goals.push({ match_id: id, player_id: p(h), scoring_team_id: 100 + h, own_goal: false });
    for (let i = 0; i < as; i++) out.goals.push({ match_id: id, player_id: p(a), scoring_team_id: 100 + a, own_goal: false });
  }
  return out;
}
const order = (s: ReturnType<typeof computeStandings>) => s.rows.map((r) => r.slot.number);

test('매너점수가 승점을 뒤집는다', () => {
  const { matches, goals } = play([1, 2, 1, 0], [1, 3, 1, 0], [2, 3, 1, 0]);
  const cards: Card[] = [{ match_id: matches[0].id, player_id: p(1), type: 'red' }];
  const s = computeStandings(slots(1, 2, 3), matches, goals, cards, players);
  assert.deepEqual(order(s), [2, 3, 1]); // 1번은 6점이지만 매너 −3
  assert.equal(s.rows[2].manner, -3);
  assert.equal(s.rows[2].points, 6);
});

test('득실차 동률이면 다득점', () => {
  const { matches, goals } = play([1, 2, 1, 0], [2, 3, 3, 2], [3, 1, 2, 1]);
  // 승점 모두 3, 득실 모두 0, 다득점: 1=2, 2=3, 3=4
  const s = computeStandings(slots(1, 2, 3), matches, goals, [], players);
  assert.deepEqual(order(s), [3, 2, 1]);
  assert.ok(s.rows.every((r) => r.goalDiff === 0 && r.points === 3));
});

test('2팀 승자승', () => {
  // 서로 1-0씩 물고 물림 → 전부 같음. 3번만 경고로 매너 −1 → 1·2는 승자승(1이 2를 이김)
  const { matches, goals } = play([1, 2, 1, 0], [2, 3, 1, 0], [3, 1, 1, 0]);
  const cards: Card[] = [{ match_id: matches[1].id, player_id: p(3), type: 'yellow' }];
  const s = computeStandings(slots(1, 2, 3), matches, goals, cards, players);
  assert.deepEqual(order(s), [1, 2, 3]);
  assert.ok(s.rows.every((r) => !r.tied));
});

test('3팀 완전 동률은 tied, 진출 미확정', () => {
  const { matches, goals } = play([1, 2, 1, 1], [1, 3, 1, 1], [2, 3, 1, 1]);
  const s = computeStandings(slots(1, 2, 3), matches, goals, [], players);
  assert.ok(s.rows.every((r) => r.rank === 1 && r.tied));
  assert.equal(resolveSource('A:1', null, { A: s }), null);
  assert.equal(resolveSource('A:1', 999, { A: s }), 999); // 수동 지정 우선
});

test('2팀짜리 조', () => {
  const { matches, goals } = play([1, 2, 0, 2]);
  const s = computeStandings(slots(1, 2), matches, goals, [], players);
  assert.deepEqual(order(s), [2, 1]);
  assert.equal(resolveSource('A:1', null, { A: s }), 102);
  assert.equal(resolveSource('A:2', null, { A: s }), 101);
});

test('경기 일부만 종료: 집계는 종료 경기만, 진출은 미확정', () => {
  const { matches, goals } = play([1, 2, 2, 0], [1, 3, 5, 0, false]);
  const cards: Card[] = [{ match_id: matches[1].id, player_id: p(1), type: 'red' }]; // 미종료 경기 카드는 무시
  const s = computeStandings(slots(1, 2, 3), matches, goals, cards, players);
  assert.equal(s.complete, false);
  assert.equal(s.rows[0].slot.number, 1);
  assert.equal(s.rows[0].goalsFor, 2);
  assert.equal(s.rows[0].manner, 0);
  assert.equal(resolveSource('A:1', null, { A: s }), null);
  assert.equal(sourceLabel('A:1'), 'A조 1위');
});

test('경고 2장 퇴장은 −3, 다음 경기 출장정지', () => {
  const { matches, goals } = play([1, 2, 0, 0], [1, 3, 0, 0]);
  const m1 = matches[0].id;
  const cards: Card[] = [
    { match_id: m1, player_id: p(1), type: 'yellow' },
    { match_id: m1, player_id: p(1), type: 'second_yellow' },
    { match_id: m1, player_id: p(1, 2), type: 'yellow' },
    { match_id: m1, player_id: p(2), type: 'yellow' },
  ];
  const s = computeStandings(slots(1, 2, 3), matches, goals, cards, players);
  const row1 = s.rows.find((r) => r.slot.number === 1)!;
  assert.equal(row1.manner, -4); // 퇴장 −3 + 다른 선수 경고 −1
  assert.equal(row1.reds, 1);

  const fx = matches.map((m) => ({ id: m.id, start_time: m.start_time, home: 100 + m.home_slot_id!, away: 100 + m.away_slot_id! }));
  assert.deepEqual([...suspendedPlayers(fx[1], fx, cards, players)], [p(1)]);
  assert.equal(suspendedPlayers(fx[0], fx, cards, players).size, 0);
});

test('자책골: 스코어엔 반영, 득점 순위에선 제외', () => {
  const { matches, goals } = play([1, 2, 1, 0]);
  goals.push({ match_id: matches[0].id, player_id: p(1, 2), scoring_team_id: 102, own_goal: true });
  const s = computeStandings(slots(1, 2), matches, goals, [], players);
  assert.ok(s.rows.every((r) => r.drawn === 1));
  goals.push({ match_id: matches[0].id, player_id: p(1), scoring_team_id: 101, own_goal: false });
  assert.deepEqual(topScorers(goals), [{ player_id: p(1), goals: 2, rank: 1 }]);
});
