export async function onRequest(context: any) {
  // Pages Function: once API yoksa offline bundle'dan servis et (public/data/latest.json zaten dist/data/latest.json)
  try {
    const url = new URL(context.request.url);
    const base = url.origin;
    // 1) dene: /data/latest.json static
    const r = await fetch(base + '/data/latest.json');
    if (r.ok) {
      const j: any = await r.json();
      const live = j.matches.filter((m: any) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length;
      const upcoming = j.matches.filter((m: any) => m.status === 'TIMED' || m.status === 'SCHEDULED').length;
      const finished = j.matches.filter((m: any) => m.status === 'FINISHED').length;
      return new Response(JSON.stringify({ success: true, count: j.matches.length, counts: { total: j.matches.length, live, upcoming, finished }, lastUpdated: j.timestamp || Date.now(), matches: j.matches, note: 'offline-bundle' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
    }
  } catch {}
  return new Response(JSON.stringify({ success: false, error: 'Offline bundle yok, VPS API bekleniyor' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}
