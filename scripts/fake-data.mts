// 화면 확인·리허설용 가짜 결과. 실제 DB에 쓴다.
// node --env-file=.env.local scripts/fake-data.mts --fill   추첨 배정 + 경기 결과 생성
// node --env-file=.env.local scripts/fake-data.mts --reset  결과·배정을 모두 비움 (팀·선수·시간표는 유지)
import { createClient } from '@supabase/supabase-js';
import { computeStandings, resolveSource, type Standings } from '../lib/standings.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const must = async <T,>(q: PromiseLike<{ data: T | null; error: unknown }>) => {
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
};

const mode = process.argv[2];
if (mode !== '--fill' && mode !== '--reset') throw new Error('--fill 또는 --reset');

// 항상 먼저 비운다
await must(db.from('goals').delete().gt('id', 0));
await must(db.from('cards').delete().gt('id', 0));
await must(
  db.from('matches').update({ status: 'scheduled', started_at: null, home_pk: null, away_pk: null, manual_home_team_id: null, manual_away_team_id: null }).gt('id', 0),
);
await must(db.from('slots').update({ team_id: null }).gt('id', 0));
if (mode === '--reset') {
  console.log('초기화 완료');
  process.exit(0);
}

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(xs: T[]) => xs[rand(xs.length)];
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const now = new Date().toISOString();

const players = await must(db.from('players').select('id, team_id'));
const roster = (team: number) => players.filter((p) => p.team_id === team);

type Side = { team: number; goals: number };
async function record(matchId: number, home: Side, away: Side, status: 'live' | 'finished', pk?: [number, number]) {
  const goals = [home, away].flatMap((s) =>
    Array.from({ length: s.goals }, () => ({ match_id: matchId, player_id: pick(roster(s.team)).id, scoring_team_id: s.team, minute: 1 + rand(15) })),
  );
  if (goals.length) await must(db.from('goals').insert(goals));
  for (const s of [home, away]) {
    if (Math.random() < 0.4) await must(db.from('cards').insert({ match_id: matchId, player_id: pick(roster(s.team)).id, type: 'yellow', minute: 1 + rand(15) }));
  }
  await must(db.from('matches').update({ status, started_at: now, home_pk: pk?.[0] ?? null, away_pk: pk?.[1] ?? null }).eq('id', matchId));
}

for (const division of ['high', 'middle'] as const) {
  const teams = shuffle(await must(db.from('teams').select('id').eq('division', division)));
  const slots = await must(db.from('slots').select('*').eq('division', division).order('number'));
  for (const [i, s] of slots.entries()) {
    s.team_id = teams[i].id;
    await must(db.from('slots').update({ team_id: s.team_id }).eq('id', s.id));
  }
  const teamOf = new Map(slots.map((s) => [s.id, s.team_id as number]));
  const matches = await must(db.from('matches').select('*').eq('division', division).order('start_time').order('court'));
  const group = matches.filter((m) => m.stage === 'group');

  for (const [i, m] of group.entries()) {
    // 고등부는 마지막 경기를 진행중으로 남겨 "A조 1위" 미확정 상태를 보여준다
    const live = division === 'high' && i === group.length - 1;
    let hs = rand(4);
    const as = rand(4);
    if (division === 'middle' && hs === as) hs++; // 2팀 조는 무승부면 동률이라 피한다
    await record(m.id, { team: teamOf.get(m.home_slot_id)!, goals: hs }, { team: teamOf.get(m.away_slot_id)!, goals: as }, live ? 'live' : 'finished');
  }

  // 고등부 첫 경기에 경고누적 퇴장 1건 → 다음 경기 출장정지 확인용
  if (division === 'high') {
    const p = pick(roster(teamOf.get(group[0].home_slot_id)!)).id;
    await must(db.from('cards').insert([
      { match_id: group[0].id, player_id: p, type: 'yellow', minute: 3 },
      { match_id: group[0].id, player_id: p, type: 'second_yellow', minute: 11 },
    ]));
    continue;
  }

  // 중등부는 토너먼트까지 끝낸다: 3·4위전은 승부차기, 결승은 정규 승부
  const [goals, cards, fresh] = await Promise.all([
    must(db.from('goals').select('*')),
    must(db.from('cards').select('*')),
    must(db.from('matches').select('*').eq('division', division)),
  ]);
  const standings: Record<string, Standings> = {};
  for (const g of new Set(slots.map((s) => s.group))) {
    standings[g] = computeStandings(
      slots.filter((s) => s.group === g),
      fresh.filter((m) => m.stage === 'group' && m.group === g),
      goals,
      cards,
      players,
    );
  }
  for (const m of matches.filter((x) => x.stage !== 'group')) {
    const home = resolveSource(m.home_source, null, standings);
    const away = resolveSource(m.away_source, null, standings);
    if (!home || !away) throw new Error(`진출팀 미확정: ${m.home_source} vs ${m.away_source}`);
    if (m.stage === 'third') await record(m.id, { team: home, goals: 1 }, { team: away, goals: 1 }, 'finished', [4, 3]);
    else await record(m.id, { team: home, goals: 2 }, { team: away, goals: 1 }, 'finished');
  }
}
console.log('가짜 데이터 생성 완료');
