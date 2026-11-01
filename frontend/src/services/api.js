import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/** Turn any axios failure into a short, human-readable message. */
export function errorMessage(error) {
  if (error?.response?.data?.detail) {
    const { detail, errors } = error.response.data;
    if (Array.isArray(errors) && errors.length) {
      return `${detail} (${errors.map((e) => e.message).join('; ')})`;
    }
    return String(detail);
  }
  if (error?.response?.status === 503) {
    return 'The API cannot reach PostgreSQL. Check DATABASE_URL and that the database is running.';
  }
  if (error?.code === 'ERR_NETWORK') {
    return 'Cannot reach the API server. Start the backend with: uvicorn app.main:app --reload';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out. Try again.';
  }
  return error?.message || 'Something went wrong.';
}

/** Field-level errors returned by FastAPI's validation handler. */
export function fieldErrors(error) {
  const errors = error?.response?.data?.errors;
  if (!Array.isArray(errors)) return [];
  return errors;
}

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export const resources = {
  students: '/students',
  faculty: '/faculty',
  departments: '/departments',
  courses: '/courses',
  semesters: '/semesters',
  offerings: '/offerings',
  assignments: '/assignments',
  enrollments: '/enrollments',
  grades: '/grades',
};

export default api;
