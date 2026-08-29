// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { UserProfile } from '@/types/models';

export const useAuth = () => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Removed API call: getCurrentUser */

  return {
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!user,
  };
};