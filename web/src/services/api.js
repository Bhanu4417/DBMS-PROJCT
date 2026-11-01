import axios from 'axios';

export const API_BASE = '/api';

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
    return 'The API cannot reach SQLite. Check the local database file is writable.';
  }
  if (error?.code === 'ERR_NETWORK') {
    return 'Cannot reach the API server. Run npm run dev in web/';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out. Try again.';
  }
  return error?.message || 'Something went wrong.';
}

/** Field-level validation errors returned by the API. */
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
