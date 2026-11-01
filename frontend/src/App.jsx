import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ResourcePage from './components/ResourcePage';
import resources from './config/resources';
import Dashboard from './pages/Dashboard';
import StudentDetail from './pages/StudentDetail';
import FacultyDetail from './pages/FacultyDetail';
import CourseDetail from './pages/CourseDetail';
import OfferingDetail from './pages/OfferingDetail';
import SemesterDetail from './pages/SemesterDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<ResourcePage config={resources.students} />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="faculty" element={<ResourcePage config={resources.faculty} />} />
        <Route path="faculty/:id" element={<FacultyDetail />} />
        <Route path="departments" element={<ResourcePage config={resources.departments} />} />
        <Route path="courses" element={<ResourcePage config={resources.courses} />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="semesters" element={<ResourcePage config={resources.semesters} />} />
        <Route path="semesters/:id" element={<SemesterDetail />} />
        <Route path="offerings" element={<ResourcePage config={resources.offerings} />} />
        <Route path="offerings/:id" element={<OfferingDetail />} />
        <Route path="assignments" element={<ResourcePage config={resources.assignments} />} />
        <Route path="enrollments" element={<ResourcePage config={resources.enrollments} />} />
        <Route path="grades" element={<ResourcePage config={resources.grades} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
