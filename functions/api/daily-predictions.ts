export async function onRequest(context: any) {
  try {
    const url = new URL(context.request.url);
    const base = url.origin;
    const r = await fetch(base + '/data/latest.json');
    if (r.ok) {
      const j: any = await r.json();
      return new Response(JSON.stringify({ success: true, ...j }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
    }
  } catch {}
  return new Response(JSON.stringify({ success: false, error: 'Veri yok' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
