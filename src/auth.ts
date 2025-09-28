import { requestAPI } from './handler';

/**
 * User role type
 */
export type UserRole = 'teacher' | 'student';

/**
 * Authentication response interface
 */
export interface IAuthResponse {
  authenticated: boolean;
  role?: UserRole;
  user_id?: string;
  message?: string;
}

/**
 * Session info interface
 */
export interface ISessionInfo {
  user_id: string;
  role: UserRole;
  session_valid: boolean;
}

// Optional addition:
export type AuthListener = (info: ISessionInfo | null) => void;

/**
 * Authentication service for Jupyter session validation and role management
 */
export class AuthService {
  static async validateSession(): Promise<IAuthResponse> {
    try {
      // Attempt backend role lookup (adjust endpoint as needed)
      const data = await requestAPI<any>('auth/role');
      if (data?.authenticated && (data.role === 'teacher' || data.role === 'student')) {
        return { authenticated: true, role: data.role };
      }
      return { authenticated: false, message: data?.message || 'Unauthenticated' };
    } catch (err) {
      console.warn('AuthService.validateSession fallback (treating as student):', err);
      // Fallback: default to student so UI still works
      return { authenticated: true, role: 'student', message: 'Fallback student role (no backend auth).' };
    }
  }
}