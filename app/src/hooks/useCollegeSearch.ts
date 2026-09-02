"use client";

import { useState, useEffect } from "react";
import { collegeNames } from '@/data/Colleges';

export interface College {
  id: string;
  name: string;
  location?: string;
  state?: string;
  type?: string;
}

export function useCollegeSearch() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all colleges on mount
  useEffect(() => {
    try {
      setLoading(true);
      setError(null);

      // Convert college names to College objects
      const collegeList: College[] = collegeNames.map((collegeName, index) => ({
        id: `college-${index}`,
        name: collegeName,
        location: "", 
        state: "", 
        type: "", 
      }));

      setColleges(collegeList);
    } catch (err) {
      console.error("Error loading colleges:", err);
      setError("Failed to load colleges. Please try again.");
      setColleges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Dummy search function for compatibility (not used anymore)
  const searchCollegesHandler = async () => {
    // No-op since all colleges are loaded upfront
  };

  return { colleges, loading, error, searchColleges: searchCollegesHandler };
}