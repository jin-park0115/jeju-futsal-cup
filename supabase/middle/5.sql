-- 중등부 5팀: A조 2팀(1·2번), B조 3팀(3~5번). 결승 A1 vs B1, 3·4위전 A2 vs B2
-- ⚠ 중등부 경기 기록(득점·카드)과 추첨 배정이 모두 지워진다. 대회 시작 전에만 실행
-- 중등부 칸(4구장 시간표): 10:45·11:15·13:00·13:30의 3·4구장
delete from matches where division = 'middle';
delete from slots where division = 'middle';

insert into slots (division, number, "group")
select 'middle', n, case when n <= 2 then 'A' else 'B' end from generate_series(1, 5) n;

insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select 'middle', 'group', m.grp, m.court, m.start_time::time, h.id, a.id
from (values
  ('A', 3, '10:45', 1, 2),
  ('B', 4, '10:45', 3, 4),
  ('B', 4, '11:15', 3, 5),
  ('B', 4, '13:00', 4, 5)
) m(grp, court, start_time, home, away)
join slots h on h.division = 'middle' and h.number = m.home
join slots a on a.division = 'middle' and a.number = m.away;

insert into matches (division, stage, court, start_time, home_source, away_source) values
  ('middle', 'final', 3, '13:30', 'A:1', 'B:1'),
  ('middle', 'third', 4, '13:30', 'A:2', 'B:2');
