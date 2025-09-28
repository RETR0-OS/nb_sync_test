/**
 * User role type
 */
export type UserRole = 'teacher' | 'student';

/**
 * Simple role determination based on URL parameters and environment
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