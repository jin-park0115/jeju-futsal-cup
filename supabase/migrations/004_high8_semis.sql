-- 고등부 8팀(4팀씩 2개 조) + 4강, 4구장 시간표. 기존 DB에 SQL Editor로 1회 실행한 뒤 supabase/middle/4.sql도 실행한다
-- ⚠ 고등부 경기 기록과 추첨 배정이 모두 지워진다. 대회 시작 전에만 실행

-- 4강 단계와 경기 코드(W:SF1 = SF1 승자, L:SF1 = SF1 패자 로 참조)
alter table matches drop constraint matches_stage_check;
alter table matches add constraint matches_stage_check check (stage in ('group', 'semi', 'third', 'final'));
alter table matches add column code text;

-- 시트를 내지 않은 8번째 팀. 이름·선수는 운영진 /teams 페이지에서 나중에 입력
insert into teams (division, name) values ('high', '고등 미정팀') on conflict do nothing;

delete from matches where division = 'high';
delete from slots where division = 'high';

insert into slots (division, number, "group")
select 'high', n, case when n <= 4 then 'A' else 'B' end from generate_series(1, 8) n;

-- 슬롯 번호: A1~A4 = 1~4, B1~B4 = 5~8
insert into matches (division, stage, "group", court, start_time, home_slot_id, away_slot_id)
select 'high', 'group', m.grp, m.court, m.start_time::time, h.id, a.id
from (values
  ('A', 1, '10:15', 1, 2),
  ('A', 2, '10:15', 3, 4),
  ('B', 3, '10:15', 5, 6),
  ('B', 4, '10:15', 7, 8),
  ('A', 1, '10:45', 1, 3),
  ('A', 2, '10:45', 2, 4),
  ('B', 1, '11:15', 5, 7),
  ('B', 2, '11:15', 6, 8),
  ('A', 1, '11:45', 1, 4),
  ('A', 2, '11:45', 2, 3),
  ('B', 3, '11:45', 5, 8),
  ('B', 4, '11:45', 6, 7)
) m(grp, court, start_time, home, away)
join slots h on h.division = 'high' and h.number = m.home
join slots a on a.division = 'high' and a.number = m.away;

insert into matches (division, stage, code, court, start_time, home_source, away_source) values
  ('high', 'semi',  'SF1', 1, '13:00', 'A:1', 'B:2'),
  ('high', 'semi',  'SF2', 2, '13:00', 'B:1', 'A:2'),
  ('high', 'final', null,  1, '13:30', 'W:SF1', 'W:SF2'),
  ('high', 'third', null,  2, '13:30', 'L:SF1', 'L:SF2');
