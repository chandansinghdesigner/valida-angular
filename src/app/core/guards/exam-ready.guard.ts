import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ExamService } from '../services/exam.service';

/** Blocks the exam screen until consent + system check were completed for that exam. */
export const examReadyGuard: CanActivateFn = (route) => {
  const exams = inject(ExamService);
  const router = inject(Router);
  const id = route.paramMap.get('id') ?? '';
  if (exams.isReady(id)) return true;
  return router.createUrlTree(['/candidate/exams', id, exams.hasConsent(id) ? 'system-check' : 'instructions']);
};

export const consentGuard: CanActivateFn = (route) => {
  const exams = inject(ExamService);
  const router = inject(Router);
  const id = route.paramMap.get('id') ?? '';
  return exams.hasConsent(id) ? true : router.createUrlTree(['/candidate/exams', id, 'instructions']);
};
