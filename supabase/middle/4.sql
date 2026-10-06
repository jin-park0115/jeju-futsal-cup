-- 중등부 4팀: 리그 1개(1~4번) 풀리그, 토너먼트 없음(리그 순위 = 최종 순위)
-- ⚠ 중등부 경기 기록(득점·카드)과 추첨 배정이 모두 지워진다. 대회 시작 전에만 실행
delete from matches where division = 'middle';
delete from slots where division = 'middle';

insert into slots (division, number, "group")
select 'middle', n, 'A' from generate_series(1, 4) n;

insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select 'middle', 'group', 'A', m.court, m.start_time::time, h.id, a.id
from (values
  (3, '10:15', 1, 2),
  (4, '10:15', 3, 4),
  (3, '11:00', 1, 3),
  (4, '11:00', 2, 4),
  (3, '11:30', 1, 4),
  (4, '11:30', 2, 3)
) m(court, start_time, home, away)
join slots h on h.division = 'middle' and h.number = m.home
join slots a on a.division = 'middle' and a.number = m.away;
