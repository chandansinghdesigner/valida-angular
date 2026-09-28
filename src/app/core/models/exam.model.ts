export type QuestionType = 'MCQ' | 'MULTIPLE' | 'TRUE_FALSE' | 'SHORT' | 'LONG';
export type QuestionState =
  | 'NOT_VISITED' | 'VISITED' | 'ANSWERED' | 'MARKED_FOR_REVIEW' | 'ANSWERED_AND_MARKED';
export type ExamStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';
export type AnswerValue = string | string[];

export interface QuestionOption { id: string; text: string; }

/** Answer keys are never sent to the browser. */
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[];
  marks: number;
}

export interface ProctoringRules {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  fullscreen: boolean;
  tabMonitoring: boolean;
  blockClipboard: boolean;
}

export interface Exam {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  passingMarks: number;
  status: ExamStatus;
  rules: ProctoringRules;
}

/** Timer values are server-provided; the client only computes the difference. */
export interface ExamSession {
  id: string;
  examId: string;
  startTime: string;
  endTime: string;
  serverTime: string;
}

export interface AnswerPayload { questionId: string; value: AnswerValue; }

export interface SubmitSummary { answered: number; total: number; timeUsedSeconds: number; auto: boolean; }

export interface ExamResult {
  examId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeUsedSeconds: number;
  passed: boolean;
  /** True when produced by built-in demo data instead of the API. */
  demo?: boolean;
}

export interface AdminStats {
  totalExams: number;
  activeExams: number;
  candidates: number;
  proctors: number;
  completedExams: number;
  liveSessions: number;
  alerts: number;
  averageScore: number;
}

export type ProctoringEventType =
  | 'SCREEN_SHARE_STOPPED' | 'FULLSCREEN_EXIT' | 'TAB_HIDDEN' | 'WINDOW_BLUR'
  | 'COPY_ATTEMPT' | 'PASTE_ATTEMPT' | 'CUT_ATTEMPT' | 'CONTEXT_MENU_ATTEMPT'
  | 'CAMERA_DISCONNECTED' | 'MICROPHONE_DISCONNECTED' | 'NETWORK_DISCONNECTED' | 'NETWORK_RESTORED';

export interface ProctoringEvent {
  id: string;
  sessionId: string;
  type: ProctoringEventType;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  /** How the event was detected — events are signals for human review, not proof of misconduct. */
  source: 'BROWSER' | 'AI' | 'SERVER';
  metadata?: Record<string, unknown>;
}
