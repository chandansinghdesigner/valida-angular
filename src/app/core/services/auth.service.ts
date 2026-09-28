import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, SignupRequest, User, UserRole } from '../models/user.model';

const TOKEN_KEY = 'valida_auth_token';
const REFRESH_TOKEN_KEY = 'valida_refresh_token';
const USER_KEY = 'valida_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  /** Emits the current authenticated user, or null when logged out. */
  private currentUserSubject = new BehaviorSubject<User | null>(this.readStoredUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();

  /** Emits true/false whenever auth state changes; used by the AuthGuard and templates. */
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(!!this.getToken());
  readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Default landing route for the signed-in user's role. */
  homeRoute(): string {
    switch (this.currentUser?.role) {
      case 'candidate': return '/candidate/exams';
      case 'admin':
      case 'super_admin': return '/admin/dashboard';
      case 'proctor': return '/dashboard';
      default: return '/login';
    }
  }

  /** POST /auth/login */
  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload).pipe(
      catchError((err) => this.demoAuth(err, this.demoUser(payload.email))),
      tap((res) => this.setSession(res, payload.remember ?? true)),
      catchError((err) => throwError(() => this.normalizeError(err, 'Invalid email or password.')))
    );
  }

  /**
   * POST /auth/signup
   * Deliberately does NOT auto-login: the account is created, and the caller
   * (SignupComponent) sends the person to /login to sign in with their new
   * credentials. If your API returns a token here, it is intentionally
   * ignored so an unverified/incomplete session is never stored.
   */
  signup(payload: SignupRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/signup`, payload).pipe(
      catchError((err) => this.demoAuth(err, this.demoUser(payload.email, payload.name))),
      catchError((err) => throwError(() => this.normalizeError(err, 'Could not create your account.')))
    );
  }

  /** POST /auth/logout, then always clears local session state regardless of API result. */
  logout(): void {
    this.http.post(`${this.baseUrl}/logout`, {}).pipe(
      catchError(() => new Observable((sub) => sub.complete()))
    ).subscribe({
      complete: () => this.clearSession()
    });
    // Clear immediately so the UI reacts without waiting on the network call.
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private setSession(res: AuthResponse, remember: boolean): void {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, res.token);
    if (res.refreshToken) {
      store.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
    const user: User = { ...res.user, role: String(res.user.role).toLowerCase() as UserRole };
    store.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  private clearSession(): void {
    [localStorage, sessionStorage].forEach((store) => {
      store.removeItem(TOKEN_KEY);
      store.removeItem(REFRESH_TOKEN_KEY);
      store.removeItem(USER_KEY);
    });
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  /**
   * Dev-only: when demoMode is on and the API cannot be reached (status 0),
   * sign in locally. Role comes from the email: contains "admin" -> admin,
   * "candidate"/"student" -> candidate, anything else -> proctor.
   */
  private demoAuth(err: { status?: number }, user: User): Observable<AuthResponse> {
    return environment.demoMode && err?.status === 0
      ? of({ token: 'demo-token', user })
      : throwError(() => err);
  }

  private demoUser(email: string, name?: string): User {
    const e = email.toLowerCase();
    const role: UserRole = e.includes('admin') ? 'admin' : /candidate|student/.test(e) ? 'candidate' : 'proctor';
    return { id: 'demo-' + e, name: name || email.split('@')[0], email, role };
  }

  private normalizeError(err: unknown, fallback: string): Error {
    const message =
      (err as { error?: { message?: string } })?.error?.message ?? fallback;
    return new Error(message);
  }
}
