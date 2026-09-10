"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Stale-while-revalidate cache shared by every useApi() caller.
 *
 * Navigating back to a page you've already opened now shows its data
 * *immediately* from this cache and refreshes it silently in the
 * background — no full-screen "Loading…" on every click. The blocking
 * spinner only shows the very first time a path is fetched.
 *
 * The cache is also mirrored to localStorage (short TTL) so a page opened
 * in a brand-new browser tab — e.g. the dashboard-detail tabs — can paint
 * from the last response instead of starting empty.
 */
const TTL_MS = 5 * 60 * 1000; // treat a persisted entry as usable for 5 min
const LS_PREFIX = "erp.cache:";

const cache = new Map(); // path -> data (freshest in-memory copy)
const inflight = new Map(); // path -> Promise (dedupes concurrent fetches)
const subscribers = new Map(); // path -> Set<(data) => void>

// Hydrate from localStorage once, on module load.
try {
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      try {
        const { t, d } = JSON.parse(window.localStorage.getItem(key));
        if (Date.now() - t < TTL_MS) cache.set(key.slice(LS_PREFIX.length), d);
        else window.localStorage.removeItem(key);
      } catch {
        window.localStorage.removeItem(key);
      }
    }
  }
} catch {
  /* private mode / disabled storage — in-memory cache still works */
}

function persist(path, data) {
  try {
    window.localStorage.setItem(LS_PREFIX + path, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* quota or disabled — ignore, memory cache is enough */
  }
}

function notify(path, data) {
  cache.set(path, data);
  persist(path, data);
  const subs = subscribers.get(path);
  if (subs) subs.forEach((fn) => fn(data));
}

/** Overwrite (or, with no data, drop) a cached path — after a mutation. */
export function mutateApi(path, data) {
  if (data === undefined) {
    cache.delete(path);
    try {
      window.localStorage.removeItem(LS_PREFIX + path);
    } catch {
      /* ignore */
    }
  } else {
    notify(path, data);
  }
}

/** Wipe everything — call on logout / 401 so one user's data can't show to the next. */
export function clearApiCache() {
  cache.clear();
  inflight.clear();
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function fetchPath(path) {
  let p = inflight.get(path);
  if (!p) {
    p = api
      .get(path)
      .then((res) => {
        notify(path, res);
        return res;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** GET a path, exposing { data, loading, error, refetch, setData, mutate }. */
export function useApi(path, { skip = false } = {}) {
  const seeded = path ? cache.get(path) : undefined;
  const [data, setData] = useState(seeded ?? null);
  const [loading, setLoading] = useState(!skip && seeded === undefined);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    if (!path) return;
    if (cache.get(path) === undefined) setLoading(true);
    setError("");
    try {
      const res = await fetchPath(path);
      setData(res);
    } catch (e) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (skip || !path) return;

    // Another component fetching the same path updates us too.
    const sub = (d) => {
      setData(d);
      setError("");
    };
    let set = subscribers.get(path);
    if (!set) {
      set = new Set();
      subscribers.set(path, set);
    }
    set.add(sub);

    // Paint cached data instantly, then always revalidate in the background.
    const c = cache.get(path);
    if (c !== undefined) {
      setData(c);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();

    return () => {
      set.delete(sub);
      if (set.size === 0) subscribers.delete(path);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip]);

  return { data, loading, error, refetch, setData, mutate: (d) => mutateApi(path, d) };
}
