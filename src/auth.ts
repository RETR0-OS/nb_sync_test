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
      const data = await requestAPI<any>('auth/validate');
      console.log('AuthService.validateSession response:', data);
      if (data?.authenticated && (data.role === 'teacher' || data.role === 'student')) {
        return { authenticated: true, role: data.role };
      }
      return { authenticated: false, message: data?.message || 'Unauthenticated' };
    } catch (err) {
      console.warn('AuthService.validateSession error (proceeding without backend auth):', err);
      // Graceful fallback: return unauthenticated but don't block functionality
      return { 
        authenticated: false, 
        message: 'Backend authentication unavailable - proceeding with limited functionality.' 
      };
    }
  }
}