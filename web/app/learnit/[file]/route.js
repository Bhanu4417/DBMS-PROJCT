import {readFileSync} from 'node:fs';
import path from 'node:path';
export const runtime='nodejs';
export async function GET(request,{params}){const {file}=await params;if(!/^[a-zA-Z_]+\.(md|mmd|png|svg)$/.test(file))return new Response('Not found',{status:404});try{const bytes=readFileSync(path.join(process.cwd(),'../learnit',file));const type=file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/plain; charset=utf-8';return new Response(bytes,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not found',{status:404});}}
