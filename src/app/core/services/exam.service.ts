import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminStats, AnswerPayload, Exam, ExamResult, ExamSession, Question, SubmitSummary
} from '../models/exam.model';
import { DEMO_ADMIN_STATS, DEMO_EXAMS, DEMO_QUESTIONS } from '../demo/demo-data';

const key = (kind: string, id: string) => `valida_${kind}_${id}`;

/**
 * REST access for the exam engine. If the API is unreachable and
 * `environment.demoMode` is true, methods fall back to demo data (same
 * approach as AlertService) so the UI can run without a backend.
 */
@Injectable({ providedIn: 'root' })
export class ExamService {
  private http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  assigned(): Observable<Exam[]> {
    return this.http.get<Exam[]>(`${this.api}/exams/assigned`).pipe(catchError((e) => this.demo(e, DEMO_EXAMS)));
  }

  get(id: string): Observable<Exam> {
    const demo = DEMO_EXAMS.find((x) => x.id === id);
    return this.http.get<Exam>(`${this.api}/exams/${id}`).pipe(
      catchError((e) => (demo ? this.demo(e, demo) : throwError(() => e)))
    );
  }

  questions(examId: string): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.api}/exams/${examId}/questions`).pipe(
      catchError((e) => this.demo(e, DEMO_QUESTIONS))
    );
  }

  /** Server returns startTime / endTime / serverTime; the client never decides the deadline. */
  startSession(examId: string): Observable<ExamSession> {
    return this.http.post<ExamSession>(`${this.api}/exams/${examId}/sessions`, {}).pipe(
      catchError((e) => {
        const exam = DEMO_EXAMS.find((x) => x.id === examId);
        const now = Date.now();
        return this.demo<ExamSession>(e, {
          id: `DEMO-${now}`, examId, startTime: new Date(now).toISOString(),
          endTime: new Date(now + (exam?.durationMinutes ?? 30) * 60_000).toISOString(),
          serverTime: new Date(now).toISOString()
        });
      })
    );
  }

  saveAnswer(sessionId: string, payload: AnswerPayload): Observable<void> {
    return this.http.put<void>(`${this.api}/sessions/${sessionId}/answers/${payload.questionId}`, payload).pipe(
      catchError((e) => this.demo<void>(e, undefined))
    );
  }

  submit(sessionId: string, examId: string, summary: SubmitSummary): Observable<ExamResult> {
    return this.http.post<ExamResult>(`${this.api}/sessions/${sessionId}/submit`, summary).pipe(
      catchError((e) => {
        const exam = DEMO_EXAMS.find((x) => x.id === examId);
        const total = exam?.totalMarks ?? 12;
        // Demo only: no answer key exists in the browser, so this score is simulated.
        const score = Math.min(total, summary.answered * 2);
        return this.demo<ExamResult>(e, {
          examId, score, totalMarks: total, percentage: Math.round((score / total) * 100),
          correct: summary.answered, incorrect: 0, skipped: summary.total - summary.answered,
          timeUsedSeconds: summary.timeUsedSeconds, passed: score >= (exam?.passingMarks ?? 6), demo: true
        });
      }),
      tap((r) => sessionStorage.setItem(key('result', examId), JSON.stringify(r)))
    );
  }

  result(examId: string): Observable<ExamResult> {
    return this.http.get<ExamResult>(`${this.api}/exams/${examId}/result`).pipe(
      catchError((e) => {
        const cached = sessionStorage.getItem(key('result', examId));
        return cached ? of(JSON.parse(cached) as ExamResult) : throwError(() => e);
      })
    );
  }

  adminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.api}/admin/stats`).pipe(catchError((e) => this.demo(e, DEMO_ADMIN_STATS)));
  }

  adminExams(): Observable<Exam[]> {
    return this.http.get<Exam[]>(`${this.api}/admin/exams`).pipe(catchError((e) => this.demo(e, DEMO_EXAMS)));
  }

  // --- pre-exam gates (consent -> system check), kept per-tab -----------------
  giveConsent(id: string): void { sessionStorage.setItem(key('consent', id), '1'); }
  hasConsent(id: string): boolean { return sessionStorage.getItem(key('consent', id)) === '1'; }
  markReady(id: string): void { sessionStorage.setItem(key('ready', id), '1'); }
  isReady(id: string): boolean { return sessionStorage.getItem(key('ready', id)) === '1'; }
  clearGates(id: string): void {
    sessionStorage.removeItem(key('consent', id));
    sessionStorage.removeItem(key('ready', id));
  }

  private demo<T>(err: unknown, data: T): Observable<T> {
    return environment.demoMode ? of(data) : throwError(() => err);
  }
}
