# 이어서 할 일 (2026-10-07 기준)

## 지금 상태
- 1~5단계 완료: DB, 순위 로직, 공개 페이지, 운영진 페이지, Realtime·Vercel 배포
- 배포 주소: https://jeju-futsal-cup.vercel.app (main에 push하면 자동 재배포)
- DB는 비어 있는 대회 전 상태: 팀·선수·시간표만 있고, 추첨 배정·결과는 없음
- 고등부 8팀(4팀씩 2개 조 → 4강 → 결승·3·4위전). 8번째는 "고등 미정팀"(이름·선수는 /teams에서 입력)
- 중등부는 4팀 단일 리그(토너먼트 없음)
- 시간표는 4구장 포스터 기준(10:15 / 10:45 / 11:15 / 11:45, 13:00 4강·중등, 13:30 결승·3·4위전)

## 다른 PC에서 이어갈 때
1. `git clone https://github.com/jin-park0115/jeju-futsal-cup.git` → `npm install`
2. **`.env.local`은 git에 없다.** 새로 만들어 4개 값을 넣는다(`.env.example` 참고)
   - Supabase 대시보드 → Project Settings → API Keys: URL, publishable key, secret key
   - `ADMIN_PATH`: Vercel → Settings → Environment Variables에 넣은 값과 같게
3. **참가 신청 xlsx도 git에 없다(개인정보).** import를 다시 돌릴 일이 있으면 `data/`에 넣는다
4. `npm run dev` → http://localhost:3000
5. Claude Code에서는 "docs/NEXT.md 읽고 이어서 하자"라고 하면 된다

## 남은 할 일
- [ ] **Vercel 서버 지역 변경** (속도). 지금 함수가 미국 동부(iad1)라 페이지당 1.3~1.8초
  - Supabase → Project Settings → General에서 지역 확인
  - Vercel → Settings → Functions → Function Region을 같은 곳으로(서울 `icn1`, 도쿄 `hnd1`) → Redeploy
- [ ] **6단계 리허설 준비** (Claude에게 요청): `docs/REHEARSAL.md` 체크리스트 작성
  - 추첨 → 4구장 동시 입력(득점·자책골·카드·경고 2장·삭제·분 수정) → 종료 후 수정
    → 고등부 4강·결승·3·4위전(직접 지정·승부차기) → 공개 화면 자동 갱신·최종 순위
  - 단계별 "기대 결과"를 적어 이상한 점을 바로 알 수 있게
- [ ] **리허설 실행**: 운영진이 실제 폰으로. 느리거나 헷갈린 점·버그를 모아서 수정 요청
- [ ] **리허설 후 초기화**: `node --env-file=.env.local scripts/fake-data.mts --reset`

## 대회 당일 아침 체크리스트
- [ ] 리허설 기록 초기화(`fake-data.mts --reset`)
- [ ] 중등부 팀 수 확인 → 바뀌었으면 Supabase SQL Editor에서 `supabase/middle/4.sql`·`5.sql`·`6.sql` 중 하나 실행
- [ ] 명단이 바뀌었으면 xlsx를 `data/`에 넣고 import
  - 미리보기: `node scripts/import-teams.mts data/<파일>.xlsx`
  - 저장: `node --env-file=.env.local scripts/import-teams.mts data/<파일>.xlsx --write`
- [ ] `ADMIN_PATH`를 새 값으로 바꾸고 Redeploy (리허설 때 퍼진 링크 무효화)
- [ ] 고등 미정팀 이름·선수 입력(`/{ADMIN_PATH}/teams`) 또는 당일 구장 화면에서 "+ 선수 추가"
- [ ] 구장 담당자 4명에게 각자 링크 전달: `https://jeju-futsal-cup.vercel.app/{ADMIN_PATH}/court/1` ~ `/court/4`
- [ ] 추첨 담당: `/{ADMIN_PATH}/draw`, 대진 확인: `/{ADMIN_PATH}/bracket`

## 자주 쓰는 명령
| 명령 | 용도 |
|---|---|
| `npm run dev` | 로컬 서버 |
| `npm test` | 순위 로직 테스트 |
| `node --env-file=.env.local scripts/fake-data.mts --fill` | 화면 확인용 가짜 결과 생성(실제 DB에 씀) |
| `node --env-file=.env.local scripts/fake-data.mts --reset` | 결과·추첨 배정 비우기(팀·선수·시간표 유지) |

## 알아둘 점
- 중등부 4팀 리그에서 1~3위가 모든 기준까지 완전 동률이면 최종 순위가 비어 있다(토너먼트가 없어 직접 지정 칸도 없음). 현장에서 결정
- 경기는 자동으로 시작·종료되지 않는다. 구장 담당자가 시작/종료 버튼을 누른다(타이머 없음, 득점 분은 시작 시각 기준 자동 입력·수정 가능)
- 토너먼트 경기는 "시작"을 누르는 순간 대진이 고정된다
