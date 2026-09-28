import { AdminStats, Exam, ProctoringRules, Question } from '../models/exam.model';

const rules: ProctoringRules = {
  camera: true, microphone: true, screenShare: true, fullscreen: true, tabMonitoring: true, blockClipboard: true
};
const day = 86_400_000;

export const DEMO_EXAMS: Exam[] = [
  { id: '14523', title: 'JavaScript Assessment', description: 'Core language, async and DOM fundamentals.',
    scheduledAt: new Date(Date.now() + day).toISOString(), durationMinutes: 30, totalQuestions: 6, totalMarks: 12,
    passingMarks: 6, status: 'ACTIVE', rules },
  { id: '15210', title: 'Angular Fundamentals', description: 'Components, services, routing and RxJS.',
    scheduledAt: new Date(Date.now() + 3 * day).toISOString(), durationMinutes: 60, totalQuestions: 6, totalMarks: 12,
    passingMarks: 7, status: 'SCHEDULED', rules },
  { id: '14711', title: 'SQL Basics', description: 'Queries, joins and indexing.',
    scheduledAt: new Date(Date.now() - 4 * day).toISOString(), durationMinutes: 45, totalQuestions: 6, totalMarks: 12,
    passingMarks: 6, status: 'COMPLETED', rules }
];

export const DEMO_QUESTIONS: Question[] = [
  { id: 'q1', type: 'MCQ', marks: 2, text: 'Which Angular feature is used for dependency injection?',
    options: [{ id: 'a', text: 'Components' }, { id: 'b', text: 'Services' }, { id: 'c', text: 'Pipes' }, { id: 'd', text: 'Directives' }] },
  { id: 'q2', type: 'MULTIPLE', marks: 2, text: 'Select all values that are falsy in JavaScript.',
    options: [{ id: 'a', text: '0' }, { id: 'b', text: "'0'" }, { id: 'c', text: 'null' }, { id: 'd', text: '[]' }] },
  { id: 'q3', type: 'TRUE_FALSE', marks: 2, text: 'Promises always resolve synchronously.',
    options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }] },
  { id: 'q4', type: 'SHORT', marks: 2, text: 'What keyword declares a block-scoped variable that cannot be reassigned?', options: [] },
  { id: 'q5', type: 'MCQ', marks: 2, text: 'Which RxJS operator delays emissions until input pauses?',
    options: [{ id: 'a', text: 'switchMap' }, { id: 'b', text: 'debounceTime' }, { id: 'c', text: 'take' }, { id: 'd', text: 'tap' }] },
  { id: 'q6', type: 'LONG', marks: 2, text: 'Explain the difference between == and === with an example.', options: [] }
];

export const DEMO_ADMIN_STATS: AdminStats = {
  totalExams: 18, activeExams: 4, candidates: 236, proctors: 12,
  completedExams: 11, liveSessions: 24, alerts: 5, averageScore: 71.4
};
