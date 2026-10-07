-- 3구장 시간표로 변경. 기존 DB에 SQL Editor로 1회 실행한 뒤 supabase/middle/4.sql도 실행한다
-- 고등부: 대진 조합은 그대로, 조별 경기 시간·구장만 바뀐다(토너먼트 13:00·13:30 1구장은 동일)
update matches m set court = v.court, start_time = v.start_time::time
from (values
  ('A', 1, '10:15', 1, 2),
  ('B', 2, '10:15', 4, 5),
  ('A', 1, '10:45', 1, 3),
  ('B', 1, '11:15', 4, 6),
  ('A', 2, '11:15', 2, 3),
  ('B', 1, '11:45', 5, 6)
) v(grp, court, start_time, home, away), slots h, slots a
where m.division = 'high' and m.stage = 'group'
  and h.id = m.home_slot_id and a.id = m.away_slot_id
  and h.number = v.home and a.number = v.away;
