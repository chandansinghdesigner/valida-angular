import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Allows a route only for the roles listed in `data: { roles: [...] }`.
 * Users with another role are sent to their own home route.
 * NOTE: this is a UX guard only — the API must enforce authorization itself.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data['roles'] as UserRole[] | undefined) ?? [];
  const role = auth.currentUser?.role;

  if (!role) {
    auth.logout();
    return false;
  }
  return allowed.includes(role) ? true : router.createUrlTree([auth.homeRoute()]);
};
