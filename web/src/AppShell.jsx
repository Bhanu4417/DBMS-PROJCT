'use client';
import {usePathname} from 'next/navigation';
import CollegeApp from './CollegeApp';

// Mounted once from app/layout.jsx so sessions and navigation state survive
// route changes. The catch-all page renders null; only /learnit bypasses here.
export default function AppShell({children}){
  const path=usePathname();
  if(path?.startsWith('/learnit'))return children;
  return <CollegeApp/>;
}
