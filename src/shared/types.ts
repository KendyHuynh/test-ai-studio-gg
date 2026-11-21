export type Language = 'vi' | 'en';
export type UiMode = 'kid' | 'standard';
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'short_answer';

export interface DomainInfo {
  id: string;
  number: number;
  nameVi: string;
  nameEn: string;
  accentHex: string;
  surfaceClass: string;
  textClass: string;
  borderClass: string;
  honorTitleVi: string;
  honorTitleEn: string;
}

export interface Competency {
  id: string; // e.g., "1.1", "4.2", "6.2"
  domainId: string;
  nameVi: string;
  nameEn: string;
  isCoreHighlighted: boolean;
}

export interface ClassRoom {
  id: string; // e.g., "LOP-5A"
  name: string;
  grade: string;
  teacherName: string;
  createdAt: string;
}

export interface SessionIdentity {
  classId: string;
  tabletNumber: number; // 1..10
  groupName: string; // e.g., "Nhóm Sao Xanh"
  groupId: string; // e.g., "May-01 · Nhóm Sao Xanh"
}

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  options?: string[];
  aiSearchKeywordHint: string;
  correctAnswer?: string; // Hidden from student payload during play
  competencyId: string; // Primary competency 1.1 .. 6.3
  competencyIds?: string[]; // 1 or more mapped competencies from 24 TT 02/2025
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  topic: string;
  sourceFileName: string;
  summary: string;
  assignedClassIds: string[];
  createdAt: string;
  questions: Question[];
}

export interface AnswerSubmission {
  id: string;
  classId: string;
  groupId: string;
  tabletNumber: number;
  groupName: string;
  lessonId: string;
  lessonTitle: string;
  questionId: string;
  competencyId: string;
  competencyIds?: string[];
  userAnswer: string;
  isCorrect: boolean;
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  elapsedMs: number;
  submittedAt: string;
  feedbackText: string;
  explanation: string;
  syncedFromOffline?: boolean;
}

export interface LeaderboardEntry {
  ClassID: string;
  GroupID: string;
  tabletNumber: number;
  groupName: string;
  Score: number;
  Rank: number;
  SkillLevel: string;
  correctCount: number;
  totalAnswered: number;
  accuracyPercent: number;
  avgElapsedMs: number;
  topDomainId: string;
}

export interface PushNotification {
  id: string;
  classId: string;
  lessonId: string;
  title: string;
  message: string;
  createdAt: string;
  readByGroupIds: string[];
}

export interface ActivityLog {
  id: string;
  classId: string;
  groupId: string;
  action: string;
  detail: string;
  competencyId?: string;
  pointsDelta?: number;
  timestamp: string;
}

export interface OfflineQueueItem {
  localId: string;
  classId: string;
  groupId: string;
  tabletNumber: number;
  groupName: string;
  lessonId: string;
  lessonTitle: string;
  questionId: string;
  competencyId: string;
  competencyIds?: string[];
  userAnswer: string;
  elapsedMs: number;
  submittedAt: string;
}
