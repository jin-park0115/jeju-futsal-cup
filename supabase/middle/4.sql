-- 중등부 4팀: 리그 1개(1~4번) 풀리그, 토너먼트 없음(리그 순위 = 최종 순위). 포스터 그대로
-- ⚠ 중등부 경기 기록(득점·카드)과 추첨 배정이 모두 지워진다. 대회 시작 전에만 실행
-- 중등부 칸(4구장 시간표): 10:45·11:15·13:00·13:30의 3·4구장
delete from matches where division = 'middle';
delete from slots where division = 'middle';

insert into slots (division, number, "group")
select 'middle', n, 'A' from generate_series(1, 4) n;

insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select 'middle', 'group', m.grp, m.court, m.start_time::time, h.id, a.id
from (values
  ('A', 3, '10:45', 1, 2),
  ('A', 4, '10:45', 3, 4),
  ('A', 3, '11:15', 1, 3),
  ('A', 4, '11:15', 2, 4),
  ('A', 3, '13:00', 1, 4),
  ('A', 4, '13:00', 2, 3)
) m(grp, court, start_time, home, away)
join slots h on h.division = 'middle' and h.number = m.home
join slots a on a.division = 'middle' and a.number = m.away;
