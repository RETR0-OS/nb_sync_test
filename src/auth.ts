/**
 * User role type
 */
export type UserRole = 'teacher' | 'student';

/**
 * Simple role determination based on URL parameters and localStorage
 * NOTE: For authoritative role, use fetchUserRoleFromBackend() which reads environment variables
 */
export function determineUserRole(): UserRole {
  // Check URL parameter first (for easy teacher mode testing)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('teacher') === 'true' || urlParams.get('role') === 'teacher') {
    return 'teacher';
  }

  // Check localStorage for persistence
  const savedRole = localStorage.getItem('nb_sync_role');
  if (savedRole === 'teacher') {
    return 'teacher';
  }

  // Default to student
  return 'student';
}

/**
 * Get authoritative user role from backend (hard-coded in backend)
 * This is the source of truth for role determination
 */
export async function fetchUserRoleFromBackend(): Promise<UserRole> {
  try {
    const { fetchUserRole } = await import('./handler');
    const roleInfo = await fetchUserRole();
    return roleInfo.role;
  } catch (error) {
    console.warn('Failed to fetch role from backend, using local fallback:', error);
    return determineUserRole();
  }
}

/**
 * Set user role and persist to localStorage
 */
export function setUserRole(role: UserRole): void {
  localStorage.setItem('nb_sync_role', role);
}

/**
 * Clear stored role
 */
export function clearUserRole(): void {
  localStorage.removeItem('nb_sync_role');
}