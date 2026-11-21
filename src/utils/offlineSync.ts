import { Language, Lesson, OfflineQueueItem, SessionIdentity } from '../shared/types';
import { readJsonSafe } from './safeJson';

const QUEUE_KEY = 'edubot_offline_queue_v1';
const CACHE_LESSONS_KEY = 'edubot_cached_lessons_v1';
const SESSION_KEY = 'edubot_active_session_v1';

export function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueueOfflineAnswer(item: OfflineQueueItem): OfflineQueueItem[] {
  const current = loadOfflineQueue();
  const filtered = current.filter(
    (x) =>
      !(
        x.classId === item.classId &&
        x.groupId === item.groupId &&
        x.lessonId === item.lessonId &&
        x.questionId === item.questionId
      ),
  );
  const next = [...filtered, item];
  saveOfflineQueue(next);
  return next;
}

export function cacheLessonsOffline(lessons: Lesson[]): void {
  try {
    localStorage.setItem(CACHE_LESSONS_KEY, JSON.stringify(lessons));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadCachedLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem(CACHE_LESSONS_KEY);
    return raw ? (JSON.parse(raw) as Lesson[]) : [];
  } catch {
    return [];
  }
}

export function loadSavedSession(): SessionIdentity | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionIdentity) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionIdentity | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function syncOfflineQueueToServer(
  lang: Language,
): Promise<{ syncedCount: number; remaining: OfflineQueueItem[] }> {
  const queue = loadOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remaining: [] };
  }

  const res = await fetch('/api/quiz/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: queue, lang }),
  });

  if (!res.ok) {
    throw new Error('Sync failed');
  }

  const data = await readJsonSafe<{ synced?: unknown[] }>(res, lang);
  if (!Array.isArray(data.synced)) {
    throw new Error('Invalid sync response');
  }

  saveOfflineQueue([]);
  return { syncedCount: queue.length, remaining: [] };
}
