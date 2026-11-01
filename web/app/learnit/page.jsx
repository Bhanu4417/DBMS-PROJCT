import Link from 'next/link';
import {readdirSync} from 'node:fs';
import path from 'node:path';
export const dynamic='force-dynamic';
export default function Study(){const files=readdirSync(path.join(process.cwd(),'../learnit')).filter(x=>/\.(md|png|svg|mmd)$/.test(x));return <main className="mx-auto max-w-5xl p-8"><Link className="text-muted text-sm" href="/">← Back to college</Link><h1 className="mt-8 mb-2">Learn it.</h1><p className="text-muted mb-8">The database, explained. Topics, diagrams and decisions for your viva.</p><div className="grid gap-3 sm:grid-cols-2">{files.map(file=><a key={file} href={'/learnit/'+file} className="card p-5 hover:bg-soft"><h2>{file}</h2><p className="text-muted text-sm mt-2">{file==='topics.md'?'Topics only · revision checklist':file.endsWith('.png')||file.endsWith('.svg')?'Complete rendered ER diagram':'Open study reference →'}</p></a>)}</div></main>}
