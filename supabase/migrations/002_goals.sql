-- 스코어를 goals 기록에서 계산하도록 변경. 기존 DB에 SQL Editor로 1회 실행 (schema.sql에는 이미 반영됨)

alter table matches
  drop column home_score,
  drop column away_score,
  drop column home_et,
  drop column away_et,
  add column started_at timestamptz;

-- scoring_team_id: 점수가 올라간 팀. 자책골이면 player_id는 상대 팀 선수
create table goals (
  id bigint generated always as identity primary key,
  match_id bigint not null references matches on delete cascade,
  player_id bigint not null references players on delete cascade,
  scoring_team_id bigint not null references teams,
  own_goal boolean not null default false,
  minute int,
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "public read" on goals for select using (true);

alter table cards
  drop constraint cards_type_check,
  add constraint cards_type_check check (type in ('yellow', 'second_yellow', 'red')),
  add column minute int,
  add column created_at timestamptz not null default now();

alter publication supabase_realtime add table goals;
