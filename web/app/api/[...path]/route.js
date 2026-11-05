import { handle } from '../../../lib/portal.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const route = request => handle(request);
export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
export const PATCH = route;
export const HEAD = route;
export const OPTIONS = route;
