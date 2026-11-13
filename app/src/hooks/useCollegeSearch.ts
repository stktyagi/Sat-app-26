"use client";

import { useState, useEffect } from "react";
import {
  collegeNames,
  searchColleges,
  loadCollegesAsync,
  subscribeToColleges,
} from "@/data/Colleges";

export interface College {
  id: string;
  name: string;
  location?: string;
  state?: string;
  type?: string;
}

export function useCollegeSearch() {
  const [colleges, setColleges] = useState<College[]>(() =>
    collegeNames.map((collegeName, index) => ({
      id: `college-${index}`,
      name: collegeName,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Subscribe to updates when cache/server resolves
    const unsubscribe = subscribeToColleges((updatedList) => {
      setColleges(
        updatedList.map((collegeName, index) => ({
          id: `college-${index}`,
          name: collegeName,
        }))
      );
    });

    // 2. Fetch/sync colleges in the background
    loadCollegesAsync().catch((err) => {
      console.warn("[useCollegeSearch] Error loading colleges:", err);
    });

    return () => unsubscribe();
  }, []);

  const searchCollegesHandler = async (query?: string): Promise<College[]> => {
    if (!query || query.trim().length === 0) {
      return colleges;
    }
    const matches = searchColleges(query);
    return matches.map((name, index) => ({
      id: `match-${index}`,
      name,
    }));
  };

  return { colleges, loading, error, searchColleges: searchCollegesHandler };
}
