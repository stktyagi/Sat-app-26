import React from 'react';
import { useUserStore } from '@/state/userStore';
import { hasAnyRole } from '@/utils/roles';

interface PrivateRoleComponentProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PrivateRoleComponent: React.FC<PrivateRoleComponentProps> = ({
  allowedRoles,
  children,
  fallback = null,
}) => {
  const userData = useUserStore((state) => state.userData);

  if (!hasAnyRole(userData, allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
