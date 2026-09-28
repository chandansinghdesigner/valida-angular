import { Routes } from '@angular/router';
import { consentGuard, examReadyGuard } from '../../core/guards/exam-ready.guard';

export const CANDIDATE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'exams' },
  { path: 'exams', loadComponent: () => import('./exams/exams.component').then((m) => m.CandidateExamsComponent) },
  { path: 'exams/:id/instructions', loadComponent: () => import('./instructions/instructions.component').then((m) => m.InstructionsComponent) },
  { path: 'exams/:id/system-check', canActivate: [consentGuard],
    loadComponent: () => import('./system-check/system-check.component').then((m) => m.SystemCheckComponent) },
  { path: 'exams/:id/start', canActivate: [examReadyGuard],
    loadComponent: () => import('./exam/exam.component').then((m) => m.ExamComponent) },
  { path: 'exams/:id/result', loadComponent: () => import('./exam-result/exam-result.component').then((m) => m.ExamResultComponent) }
];
