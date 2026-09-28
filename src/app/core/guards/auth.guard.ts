import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects dashboard / proctoring routes. Redirects unauthenticated
 * users to /login and remembers where they were headed via returnUrl.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Reverse guard for the login/signup pages: an already-authenticated
 * user is sent straight to the dashboard instead of seeing the form again.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return true;
  }

  return router.createUrlTree([auth.homeRoute() === '/login' ? '/dashboard' : auth.homeRoute()]);
};
