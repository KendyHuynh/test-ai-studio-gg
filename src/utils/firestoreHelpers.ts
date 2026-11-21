import { Lesson, Question } from '../shared/types';

/**
 * Converts arbitrary IDs (including legacy Vietnamese class codes like "LỚP-8A")
 * into safe Firestore document IDs matching ^[A-Za-z0-9_\-]+$.
 */
export function toFirestoreDocId(raw: string, maxLen = 80): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'doc').slice(0, maxLen);
}

/**
 * Normalizes a teacher-entered class code into uppercase ASCII e.g. "Lớp 6B" -> "LOP-6B".
 */
export function normalizeClassCode(raw: string): string {
  return toFirestoreDocId(raw, 64).toUpperCase();
}

/**
 * Sanitizes a Question for Firestore storage (removes undefined fields, ensures competencies).
 */
export function sanitizeQuestionForFirestore(q: Question, idx: number, lessonId: string): Question {
  const compIds =
    Array.isArray(q.competencyIds) && q.competencyIds.length > 0
      ? q.competencyIds
      : [q.competencyId || '1.1'];
  const base: Question = {
    id: toFirestoreDocId(q.id || `${lessonId}-q${idx + 1}`, 80),
    type: q.type === 'fill_blank' || q.type === 'short_answer' ? q.type : 'multiple_choice',
    questionText: (q.questionText ?? '').slice(0, 1000),
    aiSearchKeywordHint: (q.aiSearchKeywordHint ?? '').slice(0, 300),
    correctAnswer: (q.correctAnswer ?? '').slice(0, 600),
    competencyId: compIds[0].slice(0, 16),
    competencyIds: compIds.slice(0, 10),
    explanation: (q.explanation ?? '').slice(0, 1000),
  };
  if (base.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0) {
    base.options = q.options.map((opt) => String(opt).slice(0, 300));
  }
  return base;
}

/**
 * Prepares Lesson mutable payload matching firestore.rules isValidLesson bounds.
 */
export function sanitizeLessonFieldsForFirestore(lesson: Lesson, docId: string) {
  return {
    title: (lesson.title || 'Bài học Công dân số').slice(0, 240),
    topic: (lesson.topic || lesson.title || 'Công dân số').slice(0, 240),
    sourceFileName: (lesson.sourceFileName || 'BaiHoc_CongDanSo.txt').slice(0, 200),
    summary: (lesson.summary || '').slice(0, 2000),
    assignedClassIds: (lesson.assignedClassIds ?? []).slice(0, 50).map((c) => String(c).slice(0, 64)),
    questions: (lesson.questions ?? [])
      .slice(0, 30)
      .map((q, idx) => sanitizeQuestionForFirestore(q, idx, docId)),
  };
}

export interface FirestoreRestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
}

export function fromFirestoreRestValue(val: FirestoreRestValue | undefined): unknown {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue ?? '';
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue ?? '';
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue?.values ?? []).map((item) => fromFirestoreRestValue(item));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue?.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreRestValue(v);
    }
    return out;
  }
  return null;
}

