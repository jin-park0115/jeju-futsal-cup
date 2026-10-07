-- 중등부 4팀: 리그 1개(1~4번) 풀리그, 토너먼트 없음(리그 순위 = 최종 순위)
-- 3·4번은 10:45~11:45 연속 3경기(칸 배치상 불가피, 사이 15분 휴식)
-- ⚠ 중등부 경기 기록(득점·카드)과 추첨 배정이 모두 지워진다. 대회 시작 전에만 실행
-- 중등부 칸(3구장 시간표): 10:15 3구장 / 10:45 2·3구장 / 11:15 3구장 / 11:45 2·3구장
delete from matches where division = 'middle';
delete from slots where division = 'middle';

insert into slots (division, number, "group")
select 'middle', n, 'A' from generate_series(1, 4) n;

insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select 'middle', 'group', m.grp, m.court, m.start_time::time, h.id, a.id
from (values
  ('A', 3, '10:15', 1, 2),
  ('A', 2, '10:45', 1, 3),
  ('A', 3, '10:45', 2, 4),
  ('A', 3, '11:15', 3, 4),
  ('A', 2, '11:45', 1, 4),
  ('A', 3, '11:45', 2, 3)
) m(grp, court, start_time, home, away)
join slots h on h.division = 'middle' and h.number = m.home
join slots a on a.division = 'middle' and a.number = m.away;
