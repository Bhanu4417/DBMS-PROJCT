import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { errorMessage } from '../services/api';

/** Fetch a collection/detail resource with loading + error state and refetch. */
export function useFetch(url, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const paramsKey = JSON.stringify(params || {});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(url, { params });
      if (mounted.current) setData(response.data);
    } catch (requestError) {
      if (mounted.current) setError(errorMessage(requestError));
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

const OPTION_ENDPOINTS = {
  departments: '/departments/options',
  courses: '/courses/options',
  semesters: '/semesters/options',
  faculty: '/faculty/options',
  offerings: '/offerings/options',
  enrollments: '/enrollments/options',
  ungradedEnrollments: '/enrollments/options?ungraded=true',
  students: '/students/options',
};

const optionCache = new Map();

export function invalidateOptions(source) {
  if (source) optionCache.delete(source);
  else optionCache.clear();
}

/** Load select-box options once per source and share them between screens. */
export function useOptions(source) {
  const [options, setOptions] = useState(() => optionCache.get(source)?.data || []);
  const [loading, setLoading] = useState(Boolean(OPTION_ENDPOINTS[source]) && !optionCache.has(source));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const endpoint = OPTION_ENDPOINTS[source];
    if (!endpoint) {
      setLoading(false);
      return () => {};
    }

    const cached = optionCache.get(source);
    if (cached) {
      setOptions(cached.data);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    api
      .get(endpoint)
      .then((response) => {
        optionCache.set(source, { data: response.data });
        if (active) setOptions(response.data);
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [source]);

  return { options, loading, error };
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Build query params, dropping empty values. */
export function useQueryParams(values) {
  return useMemo(() => {
    const params = {};
    Object.entries(values).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) params[key] = value;
    });
    return params;
  }, [JSON.stringify(values)]);
}
