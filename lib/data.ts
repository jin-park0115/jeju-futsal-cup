// 공개 페이지용 읽기 전용 데이터 (anon 키)
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  computeStandings,
  decide,
  matchScore,
  resolveSource,
  sourceLabel,
  type Card,
  type Decided,
  type Goal,
  type Match,
  type Player,
  type Slot,
  type Standings,
} from './standings.ts';

export type Division = 'middle' | 'high';
// 대회 구장 번호. 구장 수가 바뀌면 여기와 시간표 SQL만 바꾼다
export const COURTS = [1, 2, 3, 4];
export const DIVISION_LABEL: Record<Division, string> = { high: '고등부', middle: '중등부' };
const SLOT_PREFIX: Record<Division, string> = { high: '고등', middle: '중등' };

/** 토너먼트 경기 이름: '4강1', '3·4위전', '결승' */
export function stageLabel(m: { stage: string; code: string | null }) {
  if (m.stage === 'semi') return m.code?.replace('SF', '4강') ?? '4강';
  return m.stage === 'final' ? '결승' : '3·4위전';
}

export type MatchRow = Match & {
  court: number;
  started_at: string | null;
  home_source: string | null;
  away_source: string | null;
  home_pk: number | null;
  away_pk: number | null;
  manual_home_team_id: number | null;
  manual_away_team_id: number | null;
  code: string | null;
};
export type GoalRow = Goal & { id: number; minute: number | null; created_at: string };
export type CardRow = Card & { id: number; minute: number | null; created_at: string };
export type PlayerRow = Player & { name: string };

export type MatchView = {
  match: MatchRow;
  home: number | null;
  away: number | null;
  homeLabel: string;
  awayLabel: string;
  score: number[] | null; // 시작 전이면 null
  goals: GoalRow[];
  cards: (CardRow & { team_id: number })[];
};

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>) {
  const { data, error } = await q;
  if (error) throw error;
  return data!;
}

export async function loadDivision(division: Division) {
  await connection(); // 매 요청마다 최신 데이터
  const c = db();
  const [teams, players, slots, matches] = await Promise.all([
    rows<{ id: number; name: string }>(c.from('teams').select('id, name').eq('division', division)),
    rows<PlayerRow>(c.from('players').select('id, team_id, name')),
    rows<Slot>(c.from('slots').select('*').eq('division', division).order('number')),
    rows<MatchRow>(c.from('matches').select('*').eq('division', division).order('start_time').order('court')),
  ]);
  const ids = matches.map((m) => m.id);
  const [goals, cards] = await Promise.all([
    rows<GoalRow>(c.from('goals').select('*').in('match_id', ids)),
    rows<CardRow>(c.from('cards').select('*').in('match_id', ids)),
  ]);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const playerName = new Map(players.map((p) => [p.id, p.name]));
  const playerTeam = new Map(players.map((p) => [p.id, p.team_id]));
  const slotById = new Map(slots.map((s) => [s.id, s]));

  const groups = [...new Set(slots.map((s) => s.group))].sort();
  // 조가 하나뿐이면(중등부 4팀 풀리그) '리그'로 표시
  const groupLabel = (g: string | null) => (groups.length === 1 ? '리그' : `${g}조`);
  const standings: Record<string, Standings> = Object.fromEntries(
    groups.map((g) => [
      g,
      computeStandings(
        slots.filter((s) => s.group === g),
        matches.filter((m) => m.stage === 'group' && m.group === g),
        goals,
        cards,
        players,
      ),
    ]),
  );

  // 슬롯 이름: 조가 여럿이면 '고등A1'(조 + 조 안 순번), 하나면 '중등1'
  const firstInGroup = new Map(groups.map((g) => [g, Math.min(...slots.filter((s) => s.group === g).map((s) => s.number))]));
  const slotName = (s: Slot) =>
    `${SLOT_PREFIX[division]}${groups.length > 1 ? `${s.group}${s.number - firstInGroup.get(s.group)! + 1}` : s.number}`;
  const slotLabel = (s: Slot) => (s.team_id ? teamName.get(s.team_id)! : slotName(s));
  // 끝난 토너먼트 경기(code 있는 것)의 승패. 시간순으로 채워져 결승·3·4위전이 4강 결과를 참조한다
  const decided: Decided = {};
  const side = (slotId: number | null, source: string | null, manual: number | null) => {
    if (slotId !== null) {
      const s = slotById.get(slotId)!;
      return { team: s.team_id, label: slotLabel(s) };
    }
    const team = resolveSource(source!, manual, standings, decided);
    return { team, label: team ? teamName.get(team)! : sourceLabel(source!) };
  };

  const byTime = <T extends { minute: number | null; created_at: string }>(a: T, b: T) =>
    (a.minute ?? 0) - (b.minute ?? 0) || a.created_at.localeCompare(b.created_at);

  const views: MatchView[] = matches.map((m) => {
    const h = side(m.home_slot_id, m.home_source, m.manual_home_team_id);
    const a = side(m.away_slot_id, m.away_source, m.manual_away_team_id);
    const score = m.status === 'scheduled' ? null : matchScore(m.id, h.team, a.team, goals);
    if (m.code && m.status === 'finished' && score) {
      const r = decide(h.team, a.team, score, m.home_pk, m.away_pk);
      if (r) decided[m.code] = r;
    }
    return {
      match: m,
      home: h.team,
      away: a.team,
      homeLabel: h.label,
      awayLabel: a.label,
      score,
      goals: goals.filter((g) => g.match_id === m.id).sort(byTime),
      cards: cards
        .filter((x) => x.match_id === m.id)
        .sort(byTime)
        .map((x) => ({ ...x, team_id: playerTeam.get(x.player_id)! })),
    };
  });

  // 최종 순위: 결승 승/패 = 1·2위, 3·4위전 승자 = 3위
  const winner = (v?: MatchView) => {
    if (!v || v.match.status !== 'finished' || !v.score) return null;
    const r = decide(v.home, v.away, v.score, v.match.home_pk, v.match.away_pk);
    return r && { win: teamName.get(r.win)!, lose: teamName.get(r.lose)! };
  };
  const final = winner(views.find((v) => v.match.stage === 'final'));
  const third = winner(views.find((v) => v.match.stage === 'third'));
  let podium = final && third ? [final.win, final.lose, third.win] : null;
  // 토너먼트가 없는 단일 리그: 리그가 끝나고 1~3위가 동률이 아니면 리그 순위가 최종 순위
  const league = groups.length === 1 ? standings[groups[0]] : null;
  if (!views.some((v) => v.match.stage !== 'group') && league?.complete && league.rows.slice(0, 3).every((r) => !r.tied)) {
    podium = league.rows.slice(0, 3).map((r) => slotLabel(r.slot));
  }

  return { division, groups, groupLabel, standings, decided, views, podium, teamName, playerName, slotName, slotLabel, goals, cards, players, slots, teams };
}

export async function matchDivision(id: number) {
  const { data } = await db().from('matches').select('division').eq('id', id).maybeSingle();
  return (data?.division as Division | undefined) ?? null;
}

export function parseDivision(d: string | string[] | undefined): Division {
  return d === 'middle' ? 'middle' : 'high';
}

/** 초기화 확인창에 보여줄 지워질 데이터 양 */
export async function recordCounts() {
  await connection();
  const c = db();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [goals, cards, assigned, started] = await Promise.all([
    count(c.from('goals').select('id', { count: 'exact', head: true })),
    count(c.from('cards').select('id', { count: 'exact', head: true })),
    count(c.from('slots').select('id', { count: 'exact', head: true }).not('team_id', 'is', null)),
    count(c.from('matches').select('id', { count: 'exact', head: true }).neq('status', 'scheduled')),
  ]);
  return { goals, cards, assigned, started };
}
