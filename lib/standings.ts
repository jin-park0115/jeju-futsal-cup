// 순위·진출·출장정지·득점 순위 계산. DB와 분리된 순수 함수 (테스트: standings.test.ts)

export type Slot = { id: number; number: number; group: string; team_id: number | null };
export type Player = { id: number; team_id: number };
export type Match = {
  id: number;
  stage: 'group' | 'semi' | 'third' | 'final';
  group: string | null;
  start_time: string;
  status: 'scheduled' | 'live' | 'finished';
  home_slot_id: number | null;
  away_slot_id: number | null;
};
export type Goal = { match_id: number; player_id: number; scoring_team_id: number; own_goal: boolean };
export type Card = { match_id: number; player_id: number; type: 'yellow' | 'second_yellow' | 'red' };

// 대회 요강 순서. 매너점수가 1순위
export const RANKING_ORDER = ['manner', 'points', 'goalDiff', 'goalsFor', 'headToHead'] as const;
type Criterion = (typeof RANKING_ORDER)[number];

export type Row = {
  slot: Slot;
  rank: number;
  tied: boolean; // 모든 기준이 같음 → 운영진 수동 지정 필요
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  yellows: number;
  reds: number; // second_yellow 포함
  manner: number;
};
export type Standings = { rows: Row[]; complete: boolean };

export function matchScore(matchId: number, home: number | null, away: number | null, goals: Goal[]) {
  const g = goals.filter((x) => x.match_id === matchId);
  return [g.filter((x) => x.scoring_team_id === home).length, g.filter((x) => x.scoring_team_id === away).length];
}

const isSendOff = (c: Card) => c.type === 'second_yellow' || c.type === 'red';

/** 한 조의 순위표. matches는 그 조의 조별 경기 전체(종료 안 된 것 포함) */
export function computeStandings(
  slots: Slot[],
  matches: Match[],
  goals: Goal[],
  cards: Card[],
  players: Player[],
): Standings {
  const teamOf = new Map(slots.map((s) => [s.id, s.team_id]));
  const playerTeam = new Map(players.map((p) => [p.id, p.team_id]));
  const finished = matches.filter((m) => m.status === 'finished');
  const results = finished.map((m) => {
    const home = teamOf.get(m.home_slot_id!) ?? null;
    const away = teamOf.get(m.away_slot_id!) ?? null;
    const [hs, as] = matchScore(m.id, home, away, goals);
    return { home: m.home_slot_id!, away: m.away_slot_id!, hs, as };
  });

  const rows = new Map<number, Row>(
    slots.map((slot) => [
      slot.id,
      { slot, rank: 0, tied: false, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, yellows: 0, reds: 0, manner: 0 },
    ]),
  );
  for (const r of results) {
    for (const [id, f, a] of [[r.home, r.hs, r.as], [r.away, r.as, r.hs]]) {
      const row = rows.get(id)!;
      row.played++;
      row.goalsFor += f;
      row.goalsAgainst += a;
      if (f > a) row.won++;
      else if (f === a) row.drawn++;
      else row.lost++;
    }
  }

  // 매너점수: 선수·경기 단위로 퇴장 있으면 −3(경고 감점 중복 없음), 없으면 경고 × −1
  const slotOfTeam = new Map(slots.filter((s) => s.team_id !== null).map((s) => [s.team_id!, s.id]));
  const finishedIds = new Set(finished.map((m) => m.id));
  const perPlayerMatch = Map.groupBy(
    cards.filter((c) => finishedIds.has(c.match_id)),
    (c) => `${c.match_id}:${c.player_id}`,
  );
  for (const cs of perPlayerMatch.values()) {
    const row = rows.get(slotOfTeam.get(playerTeam.get(cs[0].player_id)!)!);
    if (!row) continue;
    const yellows = cs.filter((c) => c.type === 'yellow').length;
    if (cs.some(isSendOff)) {
      row.reds++;
      row.yellows += yellows;
      row.manner -= 3;
    } else {
      row.yellows += yellows;
      row.manner -= yellows;
    }
  }
  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.points = row.won * 3 + row.drawn;
  }

  // 승자승: 동률 팀끼리의 경기만으로 승점 재계산
  const h2hPoints = (ids: Set<number>) => {
    const pts = new Map([...ids].map((id) => [id, 0]));
    for (const r of results) {
      if (!ids.has(r.home) || !ids.has(r.away)) continue;
      if (r.hs > r.as) pts.set(r.home, pts.get(r.home)! + 3);
      else if (r.hs < r.as) pts.set(r.away, pts.get(r.away)! + 3);
      else {
        pts.set(r.home, pts.get(r.home)! + 1);
        pts.set(r.away, pts.get(r.away)! + 1);
      }
    }
    return pts;
  };

  // 기준을 하나씩 적용해 같은 값끼리 묶고, 묶음 안에서 다음 기준으로 다시 나눈다
  const split = (group: Row[], criteria: readonly Criterion[]): Row[][] => {
    if (group.length <= 1 || criteria.length === 0) return [group];
    const [c, ...rest] = criteria;
    const h2h = c === 'headToHead' ? h2hPoints(new Set(group.map((r) => r.slot.id))) : null;
    const value = (r: Row) => (h2h ? h2h.get(r.slot.id)! : r[c as Exclude<Criterion, 'headToHead'>]);
    const buckets = Map.groupBy(group, value);
    return [...buckets.keys()].sort((a, b) => b - a).flatMap((k) => split(buckets.get(k)!, rest));
  };

  const ordered: Row[] = [];
  for (const bucket of split([...rows.values()].sort((a, b) => a.slot.number - b.slot.number), RANKING_ORDER)) {
    const rank = ordered.length + 1;
    for (const row of bucket) ordered.push(Object.assign(row, { rank, tied: bucket.length > 1 }));
  }
  return { rows: ordered, complete: matches.every((m) => m.status === 'finished') };
}

/** 'A:1' → 'A조 1위', 'W:SF1' → '4강1 승자', 'L:SF2' → '4강2 패자' */
export function sourceLabel(source: string) {
  const [a, b] = source.split(':');
  if (a === 'W' || a === 'L') return `${b.replace('SF', '4강')} ${a === 'W' ? '승자' : '패자'}`;
  return `${a}조 ${b}위`;
}

/** 끝난 토너먼트 경기의 승자·패자. 동점이면 승부차기로 가린다. 아직 못 가리면 null */
export function decide(home: number | null, away: number | null, score: number[], homePk: number | null, awayPk: number | null) {
  if (home === null || away === null) return null;
  const [hs, as] = score;
  const homeWins = hs !== as ? hs > as : homePk !== null && awayPk !== null && homePk !== awayPk ? homePk > awayPk : null;
  if (homeWins === null) return null;
  return homeWins ? { win: home, lose: away } : { win: away, lose: home };
}
export type Decided = Record<string, { win: number; lose: number }>;

/**
 * 진출 규칙 → team_id. 수동 지정 우선, 아니면 null(미확정)
 * - 'A:1': 조 경기가 다 끝나고 동률이 아닐 때만 확정
 * - 'W:SF1' / 'L:SF1': 코드 SF1 경기가 끝나 승패가 갈렸을 때만 확정(decided에 있을 때)
 */
export function resolveSource(source: string, manualTeamId: number | null, standings: Record<string, Standings>, decided: Decided = {}) {
  if (manualTeamId !== null) return manualTeamId;
  const [group, rank] = source.split(':');
  if (group === 'W' || group === 'L') {
    const r = decided[rank];
    return r ? (group === 'W' ? r.win : r.lose) : null;
  }
  const s = standings[group];
  if (!s?.complete) return null;
  const row = s.rows.find((r) => r.rank === Number(rank));
  return row && !row.tied ? row.slot.team_id : null;
}

export type Fixture = { id: number; start_time: string; home: number | null; away: number | null };

/** 이 경기에 출장정지인 선수 id. 각 팀의 직전 경기에서 퇴장(경고 2장 포함)을 받은 선수 */
export function suspendedPlayers(fixture: Fixture, fixtures: Fixture[], cards: Card[], players: Player[]) {
  const playerTeam = new Map(players.map((p) => [p.id, p.team_id]));
  const out = new Set<number>();
  for (const team of [fixture.home, fixture.away]) {
    if (team === null) continue;
    const prev = fixtures
      .filter((f) => f.start_time < fixture.start_time && (f.home === team || f.away === team))
      .sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
    if (!prev) continue;
    for (const c of cards) {
      if (c.match_id === prev.id && isSendOff(c) && playerTeam.get(c.player_id) === team) out.add(c.player_id);
    }
  }
  return out;
}

/** 득점 순위. 자책골 제외, 같은 골 수는 같은 순위 */
export function topScorers(goals: Goal[]) {
  const counts = Map.groupBy(
    goals.filter((g) => !g.own_goal),
    (g) => g.player_id,
  );
  const list = [...counts].map(([player_id, gs]) => ({ player_id, goals: gs.length })).sort((a, b) => b.goals - a.goals);
  return list.map((x) => ({ ...x, rank: list.findIndex((y) => y.goals === x.goals) + 1 }));
}
