import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

const STAFF = ['proctor', 'admin', 'super_admin'];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then((m) => m.SignupComponent)
  },

  // Proctor / staff console
  {
    path: 'dashboard',
    canActivate: [authGuard, roleGuard],
    data: { roles: STAFF },
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'live-proctoring/:examId',
    canActivate: [authGuard, roleGuard],
    data: { roles: STAFF },
    loadComponent: () =>
      import('./features/live-proctoring/live-proctoring.component').then((m) => m.LiveProctoringComponent)
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent)
  },

  // Candidate exam flow
  {
    path: 'candidate',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['candidate'] },
    loadChildren: () => import('./features/candidate/candidate.routes').then((m) => m.CANDIDATE_ROUTES)
  },

  // Admin
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'super_admin'] },
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES)
  },

  { path: '**', redirectTo: 'login' }
];
