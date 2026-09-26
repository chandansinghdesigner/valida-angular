export interface User {
  id: string;
  name: string;
  email: string;
  role: 'proctor' | 'admin' | 'candidate';
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  user: User;
}
