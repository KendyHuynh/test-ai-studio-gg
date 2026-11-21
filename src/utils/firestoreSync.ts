import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ActivityLog,
  AnswerSubmission,
  ClassRoom,
  Lesson,
  PushNotification,
} from '../shared/types';
import {
  sanitizeLessonFieldsForFirestore,
  toFirestoreDocId,
} from './firestoreHelpers';
import { app, auth } from './googleDrive';

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('the client is offline')
    ) {
      console.error(
        'Please check your Firebase configuration: Firestore client is offline.',
      );
      return false;
    }
    return true;
  }
}

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const displayName = (user.displayName || user.email || 'Giáo viên').slice(0, 120);
    const email = (user.email || '').slice(0, 200);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        role: 'teacher',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveClassToFirestore(
  cls: ClassRoom,
  ownerUid: string,
): Promise<void> {
  const docId = toFirestoreDocId(cls.id, 64);
  const path = `classes/${docId}`;
  try {
    const ref = doc(db, 'classes', docId);
    const snap = await getDoc(ref);
    const mutable = {
      name: (cls.name || docId).slice(0, 160),
      grade: (cls.grade || 'Khối 5').slice(0, 60),
      teacherName: (cls.teacherName || 'Giáo viên').slice(0, 120),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        ...mutable,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, mutable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteClassFromFirestore(classId: string): Promise<void> {
  const docId = toFirestoreDocId(classId, 64);
  const path = `classes/${docId}`;
  try {
    await deleteDoc(doc(db, 'classes', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveLessonToFirestore(
  lesson: Lesson,
  ownerUid: string,
): Promise<void> {
  const docId = toFirestoreDocId(lesson.id, 80);
  const path = `lessons/${docId}`;
  try {
    const ref = doc(db, 'lessons', docId);
    const snap = await getDoc(ref);
    const mutable = sanitizeLessonFieldsForFirestore(lesson, docId);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLessonFromFirestore(lessonId: string): Promise<void> {
  const docId = toFirestoreDocId(lessonId, 80);
  const path = `lessons/${docId}`;
  try {
    await deleteDoc(doc(db, 'lessons', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSubmissionToFirestore(
  sub: AnswerSubmission,
  ownerUid: string,
): Promise<void> {
  const docId = toFirestoreDocId(sub.id, 80);
  const path = `submissions/${docId}`;
  try {
    const ref = doc(db, 'submissions', docId);
    const snap = await getDoc(ref);
    const mutable = {
      userAnswer: (sub.userAnswer ?? '').slice(0, 1000),
      isCorrect: Boolean(sub.isCorrect),
      basePoints: Math.max(0, Math.min(1000, Math.round(sub.basePoints))),
      speedBonus: Math.max(0, Math.min(1000, Math.round(sub.speedBonus))),
      totalPoints: Math.max(0, Math.min(2000, Math.round(sub.totalPoints))),
      elapsedMs: Math.max(0, Math.round(sub.elapsedMs)),
      submittedAt: (sub.submittedAt || new Date().toISOString()).slice(0, 64),
      feedbackText: (sub.feedbackText ?? '').slice(0, 500),
      explanation: (sub.explanation ?? '').slice(0, 1200),
      syncedFromOffline: Boolean(sub.syncedFromOffline),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        classId: (sub.classId || 'LOP-5A').slice(0, 64),
        groupId: (sub.groupId || 'May-01').slice(0, 120),
        tabletNumber: Math.max(1, Math.min(10, Math.round(sub.tabletNumber || 1))),
        groupName: (sub.groupName || 'Nhóm 1').slice(0, 80),
        lessonId: toFirestoreDocId(sub.lessonId || 'lesson', 80),
        lessonTitle: (sub.lessonTitle || 'Bài học').slice(0, 240),
        questionId: toFirestoreDocId(sub.questionId || 'q1', 80),
        competencyId: (sub.competencyId || '1.1').slice(0, 16),
        competencyIds: (sub.competencyIds ?? [sub.competencyId || '1.1']).slice(0, 10),
        ...mutable,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, mutable);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveNotificationToFirestore(
  notif: PushNotification,
  ownerUid: string,
): Promise<void> {
  const docId = toFirestoreDocId(notif.id, 80);
  const path = `notifications/${docId}`;
  try {
    const ref = doc(db, 'notifications', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        classId: (notif.classId || 'LOP-5A').slice(0, 64),
        lessonId: toFirestoreDocId(notif.lessonId || 'lesson', 80),
        title: (notif.title || 'Thông báo').slice(0, 240),
        message: (notif.message || '').slice(0, 1000),
        readByGroupIds: (notif.readByGroupIds ?? []).slice(0, 100),
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        readByGroupIds: (notif.readByGroupIds ?? []).slice(0, 100),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveActivityLogToFirestore(
  log: ActivityLog,
  ownerUid: string,
): Promise<void> {
  const docId = toFirestoreDocId(log.id, 80);
  const path = `activityLogs/${docId}`;
  try {
    const ref = doc(db, 'activityLogs', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        classId: (log.classId || 'LOP-5A').slice(0, 64),
        groupId: (log.groupId || 'Hệ thống').slice(0, 120),
        action: (log.action || 'Hoạt động').slice(0, 120),
        detail: (log.detail || '').slice(0, 500),
        ...(log.competencyId ? { competencyId: log.competencyId.slice(0, 16) } : {}),
        ...(typeof log.pointsDelta === 'number'
          ? { pointsDelta: Math.round(log.pointsDelta) }
          : {}),
        timestamp: (log.timestamp || new Date().toISOString()).slice(0, 64),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function normalizeTimestampToIso(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function fetchTeacherCloudData(ownerUid: string): Promise<{
  classes: ClassRoom[];
  lessons: Lesson[];
  submissions: AnswerSubmission[];
  notifications: PushNotification[];
  activityLogs: ActivityLog[];
}> {
  try {
    const [clsSnap, lesSnap, subSnap, notifSnap, logSnap] = await Promise.all([
      getDocs(query(collection(db, 'classes'), where('ownerUid', '==', ownerUid))),
      getDocs(query(collection(db, 'lessons'), where('ownerUid', '==', ownerUid))),
      getDocs(query(collection(db, 'submissions'), where('ownerUid', '==', ownerUid))),
      getDocs(query(collection(db, 'notifications'), where('ownerUid', '==', ownerUid))),
      getDocs(query(collection(db, 'activityLogs'), where('ownerUid', '==', ownerUid))),
    ]);

    const classes: ClassRoom[] = clsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        name: String(data.name),
        grade: String(data.grade ?? 'Khối 5'),
        teacherName: String(data.teacherName ?? 'Giáo viên'),
        createdAt: normalizeTimestampToIso(data.createdAt),
      };
    });

    const lessons: Lesson[] = lesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        title: String(data.title),
        topic: String(data.topic ?? ''),
        sourceFileName: String(data.sourceFileName ?? ''),
        summary: String(data.summary ?? ''),
        assignedClassIds: Array.isArray(data.assignedClassIds) ? data.assignedClassIds : [],
        createdAt: normalizeTimestampToIso(data.createdAt),
        questions: Array.isArray(data.questions) ? data.questions : [],
      };
    });

    const submissions: AnswerSubmission[] = subSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        classId: String(data.classId),
        groupId: String(data.groupId),
        tabletNumber: Number(data.tabletNumber ?? 1),
        groupName: String(data.groupName ?? ''),
        lessonId: String(data.lessonId),
        lessonTitle: String(data.lessonTitle ?? ''),
        questionId: String(data.questionId),
        competencyId: String(data.competencyId ?? '1.1'),
        competencyIds: Array.isArray(data.competencyIds) ? data.competencyIds : undefined,
        userAnswer: String(data.userAnswer ?? ''),
        isCorrect: Boolean(data.isCorrect),
        basePoints: Number(data.basePoints ?? 0),
        speedBonus: Number(data.speedBonus ?? 0),
        totalPoints: Number(data.totalPoints ?? 0),
        elapsedMs: Number(data.elapsedMs ?? 0),
        submittedAt: String(data.submittedAt ?? normalizeTimestampToIso(data.createdAt)),
        feedbackText: String(data.feedbackText ?? ''),
        explanation: String(data.explanation ?? ''),
        syncedFromOffline: Boolean(data.syncedFromOffline),
      };
    });

    const notifications: PushNotification[] = notifSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        classId: String(data.classId),
        lessonId: String(data.lessonId),
        title: String(data.title),
        message: String(data.message),
        createdAt: normalizeTimestampToIso(data.createdAt),
        readByGroupIds: Array.isArray(data.readByGroupIds) ? data.readByGroupIds : [],
      };
    });

    const activityLogs: ActivityLog[] = logSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        classId: String(data.classId),
        groupId: String(data.groupId),
        action: String(data.action),
        detail: String(data.detail),
        competencyId: data.competencyId ? String(data.competencyId) : undefined,
        pointsDelta: typeof data.pointsDelta === 'number' ? data.pointsDelta : undefined,
        timestamp: String(data.timestamp ?? normalizeTimestampToIso(data.createdAt)),
      };
    });

    return { classes, lessons, submissions, notifications, activityLogs };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'teacher_workspace');
  }
}

export async function pushWorkspaceToFirestore(
  ownerUid: string,
  payload: {
    classes: ClassRoom[];
    lessons: Lesson[];
    submissions: AnswerSubmission[];
    notifications: PushNotification[];
    activityLogs: ActivityLog[];
  },
): Promise<void> {
  for (const cls of payload.classes) {
    await saveClassToFirestore(cls, ownerUid);
  }
  for (const lesson of payload.lessons) {
    await saveLessonToFirestore(lesson, ownerUid);
  }
  for (const sub of payload.submissions.slice(0, 40)) {
    await saveSubmissionToFirestore(sub, ownerUid);
  }
  for (const notif of payload.notifications.slice(0, 20)) {
    await saveNotificationToFirestore(notif, ownerUid);
  }
  for (const log of payload.activityLogs.slice(0, 30)) {
    await saveActivityLogToFirestore(log, ownerUid);
  }
}

export function defaultShareCodeForUid(uid: string): string {
  return `WS-${toFirestoreDocId(uid, 12).toUpperCase()}`;
}

export async function publishPublicWorkspace(
  workspaceCode: string,
  ownerUid: string,
  classes: ClassRoom[],
  lessons: Lesson[],
): Promise<string> {
  const docId = toFirestoreDocId(workspaceCode, 64);
  const path = `publicWorkspaces/${docId}`;
  try {
    const ref = doc(db, 'publicWorkspaces', docId);
    const snap = await getDoc(ref);
    const cleanClasses = classes.slice(0, 100).map((c) => ({
      id: String(c.id).slice(0, 64),
      name: String(c.name || c.id).slice(0, 160),
      grade: String(c.grade || 'Khối 5').slice(0, 60),
      teacherName: String(c.teacherName || 'Giáo viên').slice(0, 120),
      createdAt: String(c.createdAt || new Date().toISOString()).slice(0, 64),
    }));
    const cleanLessons = lessons.slice(0, 100).map((l) => {
      const lid = toFirestoreDocId(l.id, 80);
      return {
        id: lid,
        createdAt: String(l.createdAt || new Date().toISOString()).slice(0, 64),
        ...sanitizeLessonFieldsForFirestore(l, lid),
      };
    });

    if (!snap.exists()) {
      await setDoc(ref, {
        id: docId,
        ownerUid,
        classes: cleanClasses,
        lessons: cleanLessons,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        classes: cleanClasses,
        lessons: cleanLessons,
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
