-- schema.sql 다음에 실행. 슬롯 team_id는 비워두고 당일 추첨으로 배정한다.
-- 고등부 6팀: 3팀씩 2개 조 풀리그(1-2, 1-3, 2-3). 원래 포스터의 B조 5vs6 중복은 4vs6으로 바로잡았다.
-- 중등부 4팀: 2팀씩 2개 조(A: 1·2, B: 3·4), 조별 1경기. 팀이 늘면 slots와 경기 행만 수정한다.

insert into slots (division, number, "group")
select 'high', n, case when n <= 3 then 'A' else 'B' end from generate_series(1, 6) n
union all
select 'middle', n, case when n <= 2 then 'A' else 'B' end from generate_series(1, 4) n;

insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select m.division, 'group', m.grp, m.court, m.start_time::time, h.id, a.id
from (values
  ('high',   'A', 1, '10:15', 1, 2),
  ('high',   'B', 2, '10:15', 4, 5),
  ('middle', 'A', 3, '10:15', 1, 2),
  ('middle', 'B', 4, '10:15', 3, 4),
  ('high',   'A', 1, '11:00', 1, 3),
  ('high',   'B', 2, '11:00', 4, 6),
  ('high',   'A', 1, '11:30', 2, 3),
  ('high',   'B', 2, '11:30', 5, 6)
) m(division, grp, court, start_time, home, away)
join slots h on h.division = m.division and h.number = m.home
join slots a on a.division = m.division and a.number = m.away;

insert into matches (division, stage, court, start_time, home_source, away_source) values
  ('high',   'third', 1, '13:00', 'A:2', 'B:2'),
  ('middle', 'third', 2, '13:00', 'A:2', 'B:2'),
  ('high',   'final', 1, '13:30', 'A:1', 'B:1'),
  ('middle', 'final', 3, '13:30', 'A:1', 'B:1');
