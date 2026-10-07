'use server';
// 운영진 쓰기 전용. 서버 액션은 POST로 직접 호출될 수 있으므로 모든 액션이 비밀 키를 직접 확인한다
import { refresh } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

function admin(key: string) {
  if (!process.env.ADMIN_PATH || key !== process.env.ADMIN_PATH) throw new Error('Forbidden');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function run(q: PromiseLike<{ error: unknown }>) {
  const { error } = await q;
  if (error) throw error;
}

const id = (x: unknown) => {
  if (!Number.isInteger(x)) throw new Error('Bad id');
  return x as number;
};

export async function assignSlot(key: string, slotId: number, teamId: number | null) {
  const db = admin(key);
  // 같은 팀이 다른 슬롯에 있으면 비운다
  if (teamId !== null) await run(db.from('slots').update({ team_id: null }).eq('team_id', id(teamId)));
  await run(db.from('slots').update({ team_id: teamId === null ? null : id(teamId) }).eq('id', id(slotId)));
  refresh();
}

/** 빈 슬롯에 남은 팀을 무작위 배정. all이면 전부 비우고 다시 뽑는다(경기가 하나라도 시작됐으면 거부) */
export async function randomDraw(key: string, division: 'middle' | 'high', all = false) {
  const db = admin(key);
  if (all) {
    const { count } = await db.from('matches').select('id', { count: 'exact', head: true }).eq('division', division).neq('status', 'scheduled');
    // 운영 중 안내 문구는 throw 대신 반환(배포 환경에서 에러 메시지가 가려짐)
    if (count) return '이미 시작한 경기가 있어 다시 뽑을 수 없습니다';
    await run(db.from('slots').update({ team_id: null }).eq('division', division));
  }
  const { data: slots } = await db.from('slots').select('id, team_id').eq('division', division).order('number');
  const { data: teams } = await db.from('teams').select('id').eq('division', division);
  const used = new Set(slots!.map((s) => s.team_id));
  const free = teams!
    .filter((t) => !used.has(t.id))
    .map((t) => [Math.random(), t.id] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, t]) => t);
  for (const s of slots!.filter((x) => x.team_id === null)) {
    const team = free.shift();
    if (team === undefined) break;
    await run(db.from('slots').update({ team_id: team }).eq('id', s.id));
  }
  refresh();
}

/** 토너먼트는 시작 시점의 대진을 manual 칸에 고정한다(이후 조별 결과 수정에 흔들리지 않게) */
export async function startMatch(key: string, matchId: number, home: number, away: number) {
  const db = admin(key);
  const { data: m } = await db.from('matches').select('stage').eq('id', id(matchId)).single();
  const fix = m!.stage === 'group' ? {} : { manual_home_team_id: id(home), manual_away_team_id: id(away) };
  await run(db.from('matches').update({ status: 'live', started_at: new Date().toISOString(), ...fix }).eq('id', matchId));
  refresh();
}

export async function finishMatch(key: string, matchId: number, pk: [number, number] | null) {
  const db = admin(key);
  if (pk && !pk.every((n) => Number.isInteger(n) && n >= 0)) throw new Error('Bad pk');
  await run(db.from('matches').update({ status: 'finished', home_pk: pk?.[0] ?? null, away_pk: pk?.[1] ?? null }).eq('id', id(matchId)));
  refresh();
}

/** 경기 시작 후 경과 분(1분부터). 시작 전이면 null */
async function elapsedMinute(db: ReturnType<typeof admin>, matchId: number) {
  const { data } = await db.from('matches').select('started_at').eq('id', matchId).single();
  if (!data?.started_at) return null;
  return Math.max(1, Math.floor((Date.now() - new Date(data.started_at).getTime()) / 60000) + 1);
}

export async function addGoal(key: string, matchId: number, playerId: number, scoringTeamId: number, ownGoal: boolean) {
  const db = admin(key);
  const minute = await elapsedMinute(db, id(matchId));
  await run(db.from('goals').insert({ match_id: matchId, player_id: id(playerId), scoring_team_id: id(scoringTeamId), own_goal: ownGoal === true, minute }));
  refresh();
}

/** 같은 경기 두 번째 경고는 자동으로 second_yellow(경고누적 퇴장) */
export async function addCard(key: string, matchId: number, playerId: number, type: 'yellow' | 'red') {
  const db = admin(key);
  if (type !== 'yellow' && type !== 'red') throw new Error('Bad type');
  let saved: string = type;
  if (type === 'yellow') {
    const { count } = await db.from('cards').select('id', { count: 'exact', head: true }).eq('match_id', id(matchId)).eq('player_id', id(playerId)).eq('type', 'yellow');
    if (count) saved = 'second_yellow';
  }
  const minute = await elapsedMinute(db, id(matchId));
  await run(db.from('cards').insert({ match_id: matchId, player_id: playerId, type: saved, minute }));
  refresh();
}

const TABLE = { goal: 'goals', card: 'cards' } as const;

export async function setEventMinute(key: string, kind: 'goal' | 'card', eventId: number, minute: number | null) {
  const db = admin(key);
  if (minute !== null && !(Number.isInteger(minute) && minute >= 0 && minute <= 99)) throw new Error('Bad minute');
  await run(db.from(TABLE[kind]).update({ minute }).eq('id', id(eventId)));
  refresh();
}

export async function deleteEvent(key: string, kind: 'goal' | 'card', eventId: number) {
  const db = admin(key);
  await run(db.from(TABLE[kind]).delete().eq('id', id(eventId)));
  refresh();
}

export async function setManualTeam(key: string, matchId: number, side: 'home' | 'away', teamId: number | null) {
  const db = admin(key);
  const col = side === 'home' ? 'manual_home_team_id' : 'manual_away_team_id';
  await run(db.from('matches').update({ [col]: teamId === null ? null : id(teamId) }).eq('id', id(matchId)));
  refresh();
}

// ── 팀·선수 관리 ──
const cleanName = (x: unknown) => {
  const s = String(x ?? '').trim();
  if (!s || s.length > 30) throw new Error('Bad name');
  return s;
};

export async function addTeam(key: string, division: 'middle' | 'high', name: string) {
  const db = admin(key);
  if (division !== 'middle' && division !== 'high') throw new Error('Bad division');
  const { error } = await db.from('teams').insert({ division, name: cleanName(name) });
  if (error) return error.code === '23505' ? '같은 이름의 팀이 이미 있습니다' : '저장 실패';
  refresh();
}

export async function renameTeam(key: string, teamId: number, name: string) {
  const db = admin(key);
  const { error } = await db.from('teams').update({ name: cleanName(name) }).eq('id', id(teamId));
  if (error) return error.code === '23505' ? '같은 이름의 팀이 이미 있습니다' : '저장 실패';
  refresh();
}

export async function addPlayer(key: string, teamId: number, name: string) {
  const db = admin(key);
  await run(db.from('players').insert({ team_id: id(teamId), name: cleanName(name) }));
  refresh();
}

export async function renamePlayer(key: string, playerId: number, name: string) {
  const db = admin(key);
  await run(db.from('players').update({ name: cleanName(name) }).eq('id', id(playerId)));
  refresh();
}

/** 득점·카드 기록이 있는 선수는 지우지 않는다(지우면 기록도 함께 사라짐) */
export async function deletePlayer(key: string, playerId: number) {
  const db = admin(key);
  const [g, c] = await Promise.all([
    db.from('goals').select('id', { count: 'exact', head: true }).eq('player_id', id(playerId)),
    db.from('cards').select('id', { count: 'exact', head: true }).eq('player_id', playerId),
  ]);
  if (g.count || c.count) return '득점·카드 기록이 있는 선수는 삭제할 수 없습니다. 이름을 고쳐 주세요';
  await run(db.from('players').delete().eq('id', playerId));
  refresh();
}
