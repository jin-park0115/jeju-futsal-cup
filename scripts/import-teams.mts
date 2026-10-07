// 참가 신청 xlsx(구글 설문 응답) → teams, players
// 사용: node --env-file=.env.local scripts/import-teams.mts data/<파일>.xlsx [--write]
// --write 없이 실행하면 읽은 결과만 출력한다(DB 변경 없음).
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error('xlsx 경로를 넘겨주세요');

const wb = XLSX.read(readFileSync(file));
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
const rosterCol = Object.keys(rows[0]).find((k) => k.includes('선수 명단'))!;

type Team = { division: 'middle' | 'high'; name: string; players: string[] };
const teams: Team[] = [];
for (const row of rows) {
  // 대기팀도 정식 참가. 이름의 "(대기팀)" 표시는 뗀다
  const name = String(row['팀 이름'] ?? '').replace(/\s*\(대기팀\)\s*/, '').trim();
  if (!name) continue;
  const lines = String(row[rosterCol] ?? '').split('\n');
  // 줄 형식이 팀마다 달라서("이름/나이/학교/..." 또는 "이름 나이 학교 ...") 첫 단어만 이름으로 쓴다. 전화번호 줄은 걸러진다
  const players = lines.map((l) => l.trim().split(/[\s/]/)[0]).filter((p) => /^[가-힣]{2,5}$/.test(p));
  // 부문 칸이 없어서 선수 학교(○○중 / ○○고)로 판단
  const middle = lines.filter((l) => /중(학교)?(\s|\/|$)/.test(l)).length;
  const high = lines.filter((l) => /고(등학교)?(\s|\/|$)/.test(l)).length;
  if (middle === high) throw new Error(`부문 판단 불가: ${name}`);
  teams.push({ division: middle > high ? 'middle' : 'high', name, players });
}

for (const t of teams) console.log(t.division.padEnd(6), t.name, `${t.players.length}명`, t.players.join(', '));
if (flag !== '--write') process.exit(0);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
for (const t of teams) {
  const { data, error } = await db
    .from('teams')
    .upsert({ division: t.division, name: t.name }, { onConflict: 'division,name' })
    .select('id')
    .single();
  if (error) throw error;
  // 재실행 시 선수 명단을 통째로 교체
  await db.from('players').delete().eq('team_id', data.id);
  const { error: e2 } = await db.from('players').insert(t.players.map((name) => ({ team_id: data.id, name })));
  if (e2) throw e2;
}
console.log(`${teams.length}팀 저장 완료`);
