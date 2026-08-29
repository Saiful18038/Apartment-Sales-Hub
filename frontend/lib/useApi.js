"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** GET a path, exposing { data, loading, error, refetch, setData }. */
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(path);
      setData(res);
    } catch (e) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (skip) return;
    // This is the fetch-on-mount/path-change pattern that data hooks like
    // SWR/React Query implement internally — an async network call can't
    // run during render, so setState here (via refetch) is the correct
    // place, not a symptom of missing derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip]);

  return { data, loading, error, refetch, setData };
}
