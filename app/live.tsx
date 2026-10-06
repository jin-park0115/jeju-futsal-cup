'use client';
// DB가 바뀌면 현재 페이지를 서버에서 다시 그린다(Supabase Realtime)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 연달아 들어오는 변경은 0.5초 모아서 한 번만 갱신
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };
    const channel = db.channel('live');
    for (const table of ['matches', 'goals', 'cards', 'slots']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    // 폰 화면을 껐다 켜면 그동안 놓친 변경이 있을 수 있어 한 번 갱신
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      db.removeChannel(channel);
    };
  }, [router]);
  return null;
}
