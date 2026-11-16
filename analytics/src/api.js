import { useEffect, useState } from 'react';
const KEY = import.meta.env.VITE_DASHBOARD_KEY || '';
const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const r = await fetch(`${BASE}/api/analytics/${path}?${q}`, { headers: KEY ? { Authorization: `Bearer ${KEY}` } : {} });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(j.message || `Request failed (${r.status})`);
  return j.data;
}

/** path=null skips the request. `tick` changes force a refetch. */
export function useApi(path, params = {}, tick = 0) {
  const [s, set] = useState({ data: undefined, err: '', loading: !!path });
  const dep = JSON.stringify(params);
  useEffect(() => {
    if (!path) return set({ data: undefined, err: '', loading: false });
    let live = true;
    set((x) => ({ ...x, loading: true, err: '' }));
    api(path, params).then((data) => live && set({ data, err: '', loading: false }))
      .catch((e) => live && set({ data: undefined, err: e.message, loading: false }));
    return () => { live = false; };
  }, [path, dep, tick]);
  return s;
}
