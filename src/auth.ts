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

/**
 * Authentication service for Jupyter session validation and role management
 */
export class AuthService {
  private static instance: AuthService;
  private _currentUser: ISessionInfo | null = null;
  private _authCheckPromise: Promise<IAuthResponse> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Validate current Jupyter session and get user role
   */
  async validateSession(): Promise<IAuthResponse> {
    // Prevent multiple concurrent authentication requests
    if (this._authCheckPromise) {
      return this._authCheckPromise;
    }

    this._authCheckPromise = this._performSessionValidation();
    const result = await this._authCheckPromise;
    this._authCheckPromise = null;

    return result;
  }

  /**
   * Perform the actual session validation via backend
   */
  private async _performSessionValidation(): Promise<IAuthResponse> {
    try {
      const response = await requestAPI<IAuthResponse>('auth/validate', {
        method: 'GET'
      });

      if (response.authenticated && response.role && response.user_id) {
        this._currentUser = {
          user_id: response.user_id,
          role: response.role,
          session_valid: true
        };
        console.log('Session validated successfully:', this._currentUser);
        return response;
      } else {
        this._currentUser = null;
        return { authenticated: false, message: 'Invalid session or missing role' };
      }
    } catch (error) {
      console.error('Session validation failed:', error);
      this._currentUser = null;
      return {
        authenticated: false,
        message: `Authentication error: ${error}`
      };
    }
  }

  /**
   * Get current authenticated user info
   */
  getCurrentUser(): ISessionInfo | null {
    return this._currentUser;
  }

  /**
   * Get current user role
   */
  getCurrentRole(): UserRole | null {
    return this._currentUser?.role || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this._currentUser?.session_valid === true;
  }

  /**
   * Check if current user has teacher role
   */
  isTeacher(): boolean {
    return this._currentUser?.role === 'teacher';
  }

  /**
   * Check if current user has student role
   */
  isStudent(): boolean {
    return this._currentUser?.role === 'student';
  }

  /**
   * Force re-authentication on next request
   */
  invalidateSession(): void {
    this._currentUser = null;
    this._authCheckPromise = null;
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this._currentUser?.user_id) {
      headers['X-User-Id'] = this._currentUser.user_id;
    }

    if (this._currentUser?.role) {
      headers['X-User-Role'] = this._currentUser.role;
    }

    return headers;
  }

  /**
   * Ensure user is authenticated before proceeding
   * Throws error if authentication fails
   */
  async requireAuthentication(): Promise<ISessionInfo> {
    const authResult = await this.validateSession();

    if (!authResult.authenticated || !this._currentUser) {
      throw new Error(authResult.message || 'Authentication required');
    }

    return this._currentUser;
  }

  /**
   * Ensure user has required role
   * Throws error if user doesn't have the required role
   */
  async requireRole(requiredRole: UserRole): Promise<ISessionInfo> {
    const user = await this.requireAuthentication();

    if (user.role !== requiredRole) {
      throw new Error(`${requiredRole} role required, but user has ${user.role} role`);
    }

    return user;
  }

  /**
   * Make authenticated API request with proper headers
   */
  async makeAuthenticatedRequest<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    // Ensure we're authenticated first
    await this.requireAuthentication();

    // Add authentication headers
    const authHeaders = this.getAuthHeaders();
    const headers = {
      ...authHeaders,
      ...(init.headers || {})
    };

    return requestAPI<T>(endpoint, {
      ...init,
      headers
    });
  }
}

/**
 * Global auth service instance
 */
export const authService = AuthService.getInstance();