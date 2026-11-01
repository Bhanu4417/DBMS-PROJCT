'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import AppLayout from './layouts/AppLayout';
import ResourcePage from './components/ResourcePage';
import resources from './config/resources';
import {ToastProvider} from './hooks/useToast';
import Dashboard from './screens/Dashboard';
import StudentDetail from './screens/StudentDetail';
import FacultyDetail from './screens/FacultyDetail';
import CourseDetail from './screens/CourseDetail';
import SemesterDetail from './screens/SemesterDetail';
import OfferingDetail from './screens/OfferingDetail';
import Reports from './screens/Reports';
import Settings from './screens/Settings';
import NotFound from './screens/NotFound';
const details={students:StudentDetail,faculty:FacultyDetail,courses:CourseDetail,semesters:SemesterDetail,offerings:OfferingDetail};
export default function CollegeApp(){const path=usePathname();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);if(!mounted)return <div className="boot">shoptaker <span>/ college</span></div>;const [entity,id]=path.split('/').filter(Boolean);const Detail=details[entity];let page=!entity?<Dashboard/>:id&&Detail?<Detail/>:resources[entity]?<ResourcePage key={entity} config={resources[entity]}/>:entity==='reports'?<Reports/>:entity==='settings'?<Settings/>:<NotFound/>;return <ToastProvider><AppLayout>{page}</AppLayout></ToastProvider>;}
