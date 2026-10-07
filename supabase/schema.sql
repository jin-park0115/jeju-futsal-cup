-- Supabase SQL Editor에서 실행

create table teams (
  id bigint generated always as identity primary key,
  division text not null check (division in ('middle', 'high')),
  name text not null,
  unique (division, name)
);

create table players (
  id bigint generated always as identity primary key,
  team_id bigint not null references teams on delete cascade,
  name text not null
);

-- team_id는 당일 추첨 후 배정
create table slots (
  id bigint generated always as identity primary key,
  division text not null check (division in ('middle', 'high')),
  number int not null,
  "group" text not null,
  team_id bigint references teams on delete set null,
  unique (division, number)
);

-- 조별 경기는 *_slot_id, 토너먼트는 *_source('A:1' = A조 1위, 'W:SF1' = SF1 승자, 'L:SF1' = SF1 패자) 사용
create table matches (
  id bigint generated always as identity primary key,
  division text not null check (division in ('middle', 'high')),
  stage text not null check (stage in ('group', 'semi', 'third', 'final')),
  code text, -- 토너먼트 경기 코드(SF1 등). 다른 경기가 W:SF1/L:SF1로 참조
  "group" text,
  court int not null,
  start_time time not null,
  started_at timestamptz,
  home_slot_id bigint references slots,
  away_slot_id bigint references slots,
  home_source text,
  away_source text,
  -- 스코어는 goals에서 계산. 토너먼트 동점이면 바로 승부차기
  home_pk int,
  away_pk int,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  manual_home_team_id bigint references teams,
  manual_away_team_id bigint references teams
);

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

-- second_yellow: 한 경기 두 번째 경고(경고누적 퇴장)
create table cards (
  id bigint generated always as identity primary key,
  match_id bigint not null references matches on delete cascade,
  player_id bigint not null references players on delete cascade,
  type text not null check (type in ('yellow', 'second_yellow', 'red')),
  minute int,
  created_at timestamptz not null default now()
);

-- anon은 읽기만. 쓰기 정책이 없으므로 쓰기는 service role(RLS 우회)만 가능
alter table teams enable row level security;
alter table players enable row level security;
alter table slots enable row level security;
alter table matches enable row level security;
alter table goals enable row level security;
alter table cards enable row level security;

create policy "public read" on teams for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on slots for select using (true);
create policy "public read" on matches for select using (true);
create policy "public read" on goals for select using (true);
create policy "public read" on cards for select using (true);

-- 5단계 Realtime 구독용
alter publication supabase_realtime add table matches, goals, cards, slots;
