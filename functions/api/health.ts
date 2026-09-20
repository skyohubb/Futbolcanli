export async function onRequest() {
  return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString(), mode: 'pages-static', note: 'Canli API VPS/Tunnel uzerinde ayri calisir, bu endpoint offline bundle fallback icin' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
