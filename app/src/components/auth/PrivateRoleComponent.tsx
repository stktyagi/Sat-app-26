// src/components/auth/PrivateRoleComponent.tsx
import React from 'react';
import { View } from 'react-native';
import { useUserStore } from '@/state/userStore';

interface PrivateRoleComponentProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user roles.
 * Only renders children if the user has at least one of the allowed roles.
 *
 * @param allowedRoles - Array of role names that are permitted to view the content
 * @param children - Content to render if user has required role
 * @param fallback - Optional content to render if user doesn't have required role
 *
 * @example
 * ```tsx
 * <PrivateRoleComponent allowedRoles={['admin', 'moderator']}>
 *   <View>
 *     <Text>Admin/Moderator only content</Text>
 *   </View>
 * </PrivateRoleComponent>
 * ```
 */
export const PrivateRoleComponent: React.FC<PrivateRoleComponentProps> = ({
  allowedRoles,
  children,
  fallback = null,
}) => {
  const userData = useUserStore((state) => state.userData);

  // Check if user has any of the required roles
  const hasRequiredRole = userData?.roles?.some((userRole) =>
    allowedRoles.includes(userRole)
  );

  if (!hasRequiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
