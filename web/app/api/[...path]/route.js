import { dispatch } from '../../../lib/api.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  let body;
  if (['POST', 'PUT'].includes(request.method)) {
    try { body = await request.json(); }
    catch { return Response.json({ detail: 'Request body must be valid JSON' }, { status: 400 }); }
  }
  const result = dispatch(request.method, request.url, body);
  if (result.headers?.['Content-Type']?.startsWith('text/csv')) {
    return new Response(result.body, { status: result.status, headers: result.headers });
  }
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store', ...result.headers } });
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
