export type CandidateStatus = 'active' | 'waiting' | 'in-progress' | 'completed';

export interface Candidate {
  id: string;
  name: string;
  examId: string;
  status: CandidateStatus;
}

export interface ProctorStats {
  activeProctors: number;
  liveExams: number;
  flagsTriggered: number;
}
