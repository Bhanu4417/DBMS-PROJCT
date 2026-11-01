'use client';
import NextLink from 'next/link';
import {usePathname,useRouter,useSearchParams as nextSearchParams} from 'next/navigation';
export function Link({to,children,...props}) {return <NextLink href={to} {...props}>{children}</NextLink>;}
export function NavLink({to,end,className,children,...props}) {const path=usePathname();const isActive=end?path===to:path===to||path.startsWith(to+'/');return <NextLink href={to} className={typeof className==='function'?className({isActive}):className} {...props}>{typeof children==='function'?children({isActive}):children}</NextLink>;}
export function useLocation(){return {pathname:usePathname()};}
export function useNavigate(){const router=useRouter();return (href)=>router.push(href);}
export function useSearchParams(){return [nextSearchParams()];}
export function useParams(){const path=usePathname();return {id:path.split('/')[2]};}
