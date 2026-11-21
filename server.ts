import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  FirestoreRestValue,
  fromFirestoreRestValue,
} from './src/utils/firestoreHelpers';
import { getCompetencyById } from './src/shared/competencies';
import {
  buildCompetencyMatrix,
  buildDomainChampions,
  buildLeaderboard,
  calculatePoints,
  formatGroupId,
  isAnswerMatch,
} from './src/shared/scoring';
import {
  ActivityLog,
  AnswerSubmission,
  ClassRoom,
  Language,
  Lesson,
  OfflineQueueItem,
  PushNotification,
  Question,
  QuestionType,
} from './src/shared/types';
import { generateLessonQuestions, evaluateShortAnswerWithAI } from './server/gemini';
import { loadStore, saveStore } from './server/store';

dotenv.config();

function normalizeClassCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readFirebaseConfig(): {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
} {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return {};
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch {
    return {};
  }
}

const hydratedWorkspaceCache = new Map<string, number>();

async function hydrateFromPublicWorkspace(workspaceCode: string): Promise<void> {
  const cleanCode = workspaceCode.trim();
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(cleanCode)) return;
  const lastFetched = hydratedWorkspaceCache.get(cleanCode) ?? 0;
  if (Date.now() - lastFetched < 30_000) return;

  const cfg = readFirebaseConfig();
  if (!cfg.projectId || !cfg.firestoreDatabaseId || !cfg.apiKey) return;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId,
    )}/databases/${encodeURIComponent(
      cfg.firestoreDatabaseId,
    )}/documents/publicWorkspaces/${encodeURIComponent(
      cleanCode,
    )}?key=${encodeURIComponent(cfg.apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) return;
    const doc = (await res.json()) as {
      fields?: Record<string, FirestoreRestValue>;
    };
    if (!doc.fields) return;

    const decoded = fromFirestoreRestValue({
      mapValue: { fields: doc.fields },
    }) as {
      classes?: ClassRoom[];
      lessons?: Lesson[];
    };

    const store = loadStore();
    let changed = false;

    if (Array.isArray(decoded.classes) && decoded.classes.length > 0) {
      const classMap = new Map(store.classes.map((c) => [c.id, c]));
      for (const cls of decoded.classes) {
        if (cls?.id && cls?.name) {
          classMap.set(cls.id, cls);
          changed = true;
        }
      }
      store.classes = Array.from(classMap.values());
    }

    if (Array.isArray(decoded.lessons) && decoded.lessons.length > 0) {
      const lessonMap = new Map(store.lessons.map((l) => [l.id, l]));
      for (const lesson of decoded.lessons) {
        if (
          lesson?.id &&
          lesson?.title &&
          Array.isArray(lesson.questions) &&
          lesson.questions.length > 0
        ) {
          lessonMap.set(lesson.id, lesson);
          changed = true;
        }
      }
      store.lessons = Array.from(lessonMap.values());
    }

    if (changed) {
      saveStore(store);
    }
    hydratedWorkspaceCache.set(cleanCode, Date.now());
  } catch {
    // Non-fatal: continue with current server store
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'EduBot Digital Citizen' });
  });

  app.post('/api/teacher/verify-pin', (req, res) => {
    const { pin } = req.body as { pin?: string };
    const expectedPin = process.env.TEACHER_PIN || '2025';
    if (String(pin ?? '').trim() !== expectedPin) {
      res.status(401).json({ error: 'Mã PIN Giáo viên chưa đúng. Vui lòng thử lại.' });
      return;
    }
    res.json({ ok: true });
  });

  // Bootstrap state for a class & role (also hydrates server store if ?ws= share code is passed)
  app.get('/api/bootstrap', async (req, res) => {
    const ws = typeof req.query.ws === 'string' ? req.query.ws : '';
    if (ws) {
      await hydrateFromPublicWorkspace(ws);
    }

    const store = loadStore();
    const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
    const lang = (req.query.lang === 'en' ? 'en' : 'vi') as Language;
    const includeAnswers = req.query.role === 'teacher';

    const sanitizedLessons = store.lessons.map((lesson) => ({
      ...lesson,
      questions: lesson.questions.map((q) =>
        includeAnswers ? q : { ...q, correctAnswer: undefined },
      ),
    }));

    const targetClassId = classId || store.classes[0]?.id || 'LOP-5A';
    const leaderboard = buildLeaderboard(targetClassId, store.submissions, lang);
    const domainChampions = buildDomainChampions(targetClassId, store.submissions, lang);
    const competencyMatrix = buildCompetencyMatrix(
      store.lessons,
      store.submissions,
      classId || undefined,
    );

    const notifications = store.notifications
      .filter((n) => !classId || n.classId === classId)
      .slice(0, 20);

    const activityLogs = store.activityLogs
      .filter((l) => !classId || l.classId === classId)
      .slice(0, 60);

    const rawAppUrl = process.env.APP_URL || '';
    const sharedAppUrl = rawAppUrl.includes('ais-dev-')
      ? rawAppUrl.replace('ais-dev-', 'ais-pre-')
      : rawAppUrl;

    res.json({
      classes: store.classes,
      lessons: sanitizedLessons,
      leaderboard,
      domainChampions,
      competencyMatrix,
      notifications,
      activityLogs,
      submissionsCount: store.submissions.length,
      sharedAppUrl,
      ...(includeAnswers ? { submissions: store.submissions } : {}),
    });
  });

  // Export/Import full classes + lessons package (zero-login transfer between Dev and Shared App)
  app.get('/api/workspace/export', (_req, res) => {
    const store = loadStore();
    res.json({
      exportedAt: new Date().toISOString(),
      classes: store.classes,
      lessons: store.lessons,
    });
  });

  app.post('/api/workspace/import', (req, res) => {
    const payload = req.body as {
      classes?: ClassRoom[];
      lessons?: Lesson[];
    };
    if (!Array.isArray(payload.classes) && !Array.isArray(payload.lessons)) {
      res.status(400).json({ error: 'Tệp cấu hình không hợp lệ.' });
      return;
    }
    const store = loadStore();
    let importedClasses = 0;
    let importedLessons = 0;

    if (Array.isArray(payload.classes)) {
      const classMap = new Map(store.classes.map((c) => [c.id, c]));
      for (const cls of payload.classes) {
        if (cls?.id && cls?.name) {
          classMap.set(cls.id, cls);
          importedClasses++;
        }
      }
      store.classes = Array.from(classMap.values());
    }

    if (Array.isArray(payload.lessons)) {
      const lessonMap = new Map(store.lessons.map((l) => [l.id, l]));
      for (const lesson of payload.lessons) {
        if (lesson?.id && lesson?.title && Array.isArray(lesson.questions) && lesson.questions.length > 0) {
          lessonMap.set(lesson.id, lesson);
          importedLessons++;
        }
      }
      store.lessons = Array.from(lessonMap.values());
    }

    saveStore(store);
    res.json({ ok: true, importedClasses, importedLessons });
  });

  // Create or update a classroom
  app.post('/api/classes', (req, res) => {
    const { id, name, grade, teacherName } = req.body as Partial<ClassRoom>;
    const cleanId = normalizeClassCode(id ?? '');
    if (!cleanId || !name?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập Mã lớp (không dấu) và Tên lớp học.' });
      return;
    }

    const store = loadStore();
    const existing = store.classes.find((c) => c.id === cleanId);
    let savedClass: ClassRoom;
    if (existing) {
      existing.name = name.trim();
      existing.grade = grade?.trim() || existing.grade;
      existing.teacherName = teacherName?.trim() || existing.teacherName;
      savedClass = existing;
    } else {
      savedClass = {
        id: cleanId,
        name: name.trim(),
        grade: grade?.trim() || 'Khối 5',
        teacherName: teacherName?.trim() || 'Giáo viên',
        createdAt: new Date().toISOString(),
      };
      store.classes.unshift(savedClass);
    }
    saveStore(store);
    res.json({ classes: store.classes, createdId: cleanId, classRoom: savedClass });
  });

  // Update an existing classroom (with optional class code rename cascade)
  app.put('/api/classes/:id', (req, res) => {
    const oldId = decodeURIComponent(req.params.id);
    const { newId, name, grade, teacherName } = req.body as Partial<ClassRoom> & {
      newId?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Tên lớp học không được để trống.' });
      return;
    }

    const store = loadStore();
    const target = store.classes.find((c) => c.id === oldId);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy lớp học cần chỉnh sửa.' });
      return;
    }

    const nextId = newId?.trim() ? normalizeClassCode(newId) : oldId;
    if (!nextId) {
      res.status(400).json({ error: 'Mã lớp mới không hợp lệ.' });
      return;
    }

    if (nextId !== oldId) {
      const conflict = store.classes.find((c) => c.id === nextId);
      if (conflict) {
        res.status(409).json({ error: `Mã lớp "${nextId}" đã tồn tại.` });
        return;
      }
      target.id = nextId;
      for (const lesson of store.lessons) {
        lesson.assignedClassIds = Array.from(
          new Set(lesson.assignedClassIds.map((cid) => (cid === oldId ? nextId : cid))),
        );
      }
      for (const sub of store.submissions) {
        if (sub.classId === oldId) sub.classId = nextId;
      }
      for (const notif of store.notifications) {
        if (notif.classId === oldId) notif.classId = nextId;
      }
      for (const log of store.activityLogs) {
        if (log.classId === oldId) log.classId = nextId;
      }
    }

    target.name = name.trim();
    target.grade = grade?.trim() || target.grade;
    target.teacherName = teacherName?.trim() || target.teacherName;

    store.activityLogs.unshift({
      id: `log-${Date.now()}`,
      classId: target.id,
      groupId: 'Giáo viên',
      action: 'Cập nhật lớp học',
      detail: `${target.id} · ${target.name} (${target.grade} - ${target.teacherName})`,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    res.json({ classRoom: target, classes: store.classes, oldId });
  });

  // Delete a classroom
  app.delete('/api/classes/:id', (req, res) => {
    const classId = decodeURIComponent(req.params.id);
    const store = loadStore();
    const exists = store.classes.some((c) => c.id === classId);
    if (!exists) {
      res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      return;
    }
    if (store.classes.length <= 1) {
      res.status(400).json({ error: 'Cần giữ lại ít nhất 1 lớp học trong hệ thống.' });
      return;
    }

    store.classes = store.classes.filter((c) => c.id !== classId);
    for (const lesson of store.lessons) {
      lesson.assignedClassIds = lesson.assignedClassIds.filter((cid) => cid !== classId);
    }

    saveStore(store);
    res.json({ ok: true, classes: store.classes });
  });

  // Step 2: Upload lesson text/file and generate 24-competency quiz with Gemini
  app.post('/api/lessons/generate', async (req, res) => {
    const {
      title,
      sourceFileName,
      textContent,
      base64Data,
      mimeType,
      questionCount,
      assignedClassIds,
      language,
    } = req.body as {
      title?: string;
      sourceFileName?: string;
      textContent?: string;
      base64Data?: string;
      mimeType?: string;
      questionCount?: number;
      assignedClassIds?: string[];
      language?: Language;
    };

    if (!textContent?.trim() && !base64Data) {
      res.status(400).json({
        error: 'Vui lòng tải tệp bài học hoặc dán nội dung bài học trước khi tạo câu hỏi.',
      });
      return;
    }

    try {
      const generated = await generateLessonQuestions({
        title,
        sourceFileName: sourceFileName || 'BaiHoc_CongDanSo.txt',
        textContent,
        base64Data,
        mimeType,
        questionCount: questionCount ?? 15,
        language: language ?? 'vi',
      });

      const store = loadStore();
      const targetClasses =
        assignedClassIds && assignedClassIds.length > 0
          ? assignedClassIds
          : [store.classes[0]?.id || 'LOP-5A'];

      const newLesson: Lesson = {
        id: `lesson-${Date.now()}`,
        title: generated.title,
        topic: generated.topic,
        sourceFileName: sourceFileName || 'BaiHoc_CongDanSo.txt',
        summary: generated.summary,
        assignedClassIds: targetClasses,
        createdAt: new Date().toISOString(),
        questions: generated.questions,
      };

      store.lessons.unshift(newLesson);

      // Push notification for every assigned class
      for (const classId of targetClasses) {
        const notif: PushNotification = {
          id: `notif-${Date.now()}-${classId}`,
          classId,
          lessonId: newLesson.id,
          title: `Bài tập mới: ${newLesson.title}`,
          message: `Giáo viên vừa giao ${newLesson.questions.length} câu hỏi Công dân số cho lớp ${classId}. Hãy tra cứu từ khóa AI và chinh phục bảng xếp hạng!`,
          createdAt: new Date().toISOString(),
          readByGroupIds: [],
        };
        store.notifications.unshift(notif);
      }

      store.activityLogs.unshift({
        id: `log-${Date.now()}`,
        classId: targetClasses[0],
        groupId: 'Giáo viên',
        action: 'Tạo bài học AI',
        detail: `${newLesson.title} (${newLesson.questions.length} câu hỏi · Giao cho ${targetClasses.join(', ')})`,
        timestamp: new Date().toISOString(),
      });

      saveStore(store);
      res.json({ lesson: newLesson });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không thể tạo câu hỏi từ Gemini AI.';
      console.error('Gemini lesson generation error:', err);
      res.status(502).json({
        error: `Lỗi kết nối AI tạo câu hỏi: ${message}`,
      });
    }
  });

  // Update an existing lesson and its full questions list
  app.put('/api/lessons/:id', (req, res) => {
    const lessonId = req.params.id;
    const { title, topic, summary, assignedClassIds, questions } = req.body as Partial<Lesson>;

    if (!title?.trim()) {
      res.status(400).json({ error: 'Tên bài học không được để trống.' });
      return;
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Bài học cần có ít nhất 1 câu hỏi.' });
      return;
    }

    const store = loadStore();
    const lesson = store.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Không tìm thấy bài học cần chỉnh sửa.' });
      return;
    }

    const sanitizedQuestions: Question[] = questions.map((q, idx) => {
      const compIds =
        Array.isArray(q.competencyIds) && q.competencyIds.length > 0
          ? q.competencyIds
          : [q.competencyId || '1.1'];
      const qType: QuestionType =
        q.type === 'fill_blank' || q.type === 'short_answer'
          ? q.type
          : 'multiple_choice';
      const cleanedOptions =
        qType === 'multiple_choice'
          ? (q.options ?? []).map((opt) => opt.trim()).filter(Boolean)
          : undefined;

      return {
        id: q.id?.trim() || `${lessonId}-q${idx + 1}`,
        type: qType,
        questionText: (q.questionText ?? '').trim(),
        ...(cleanedOptions && cleanedOptions.length >= 2 ? { options: cleanedOptions } : {}),
        aiSearchKeywordHint: (q.aiSearchKeywordHint ?? '').trim() || 'công dân số TT 02/2025',
        correctAnswer: (q.correctAnswer ?? '').trim(),
        competencyId: compIds[0],
        competencyIds: compIds,
        explanation: (q.explanation ?? '').trim(),
      };
    });

    if (sanitizedQuestions.some((q) => !q.questionText || !q.correctAnswer)) {
      res.status(400).json({
        error: 'Mỗi câu hỏi cần có đầy đủ nội dung câu hỏi và đáp án đúng.',
      });
      return;
    }

    lesson.title = title.trim();
    lesson.topic = topic?.trim() || lesson.topic;
    lesson.summary = summary?.trim() ?? lesson.summary;
    lesson.assignedClassIds = Array.isArray(assignedClassIds)
      ? Array.from(new Set(assignedClassIds))
      : lesson.assignedClassIds;
    lesson.questions = sanitizedQuestions;

    store.activityLogs.unshift({
      id: `log-${Date.now()}`,
      classId: lesson.assignedClassIds[0] || store.classes[0]?.id || 'LOP-5A',
      groupId: 'Giáo viên',
      action: 'Chỉnh sửa bài học',
      detail: `${lesson.title} (${lesson.questions.length} câu hỏi)`,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    res.json({ lesson });
  });

  // Merge cloud Firestore state into local server store for 10 shared student tablets
  app.post('/api/sync/cloud-hydrate', (req, res) => {
    const payload = req.body as {
      classes?: ClassRoom[];
      lessons?: Lesson[];
      submissions?: AnswerSubmission[];
      notifications?: PushNotification[];
      activityLogs?: ActivityLog[];
    };

    const store = loadStore();

    if (Array.isArray(payload.classes) && payload.classes.length > 0) {
      const classMap = new Map(store.classes.map((c) => [c.id, c]));
      for (const cls of payload.classes) {
        if (cls?.id && cls?.name) {
          classMap.set(cls.id, cls);
        }
      }
      store.classes = Array.from(classMap.values());
    }

    if (Array.isArray(payload.lessons) && payload.lessons.length > 0) {
      const lessonMap = new Map(store.lessons.map((l) => [l.id, l]));
      for (const lesson of payload.lessons) {
        if (lesson?.id && lesson?.title && Array.isArray(lesson.questions) && lesson.questions.length > 0) {
          lessonMap.set(lesson.id, lesson);
        }
      }
      store.lessons = Array.from(lessonMap.values());
    }

    if (Array.isArray(payload.submissions) && payload.submissions.length > 0) {
      const subMap = new Map(store.submissions.map((s) => [s.id, s]));
      for (const sub of payload.submissions) {
        if (sub?.id) {
          subMap.set(sub.id, sub);
        }
      }
      store.submissions = Array.from(subMap.values());
    }

    if (Array.isArray(payload.notifications) && payload.notifications.length > 0) {
      const notifMap = new Map(store.notifications.map((n) => [n.id, n]));
      for (const notif of payload.notifications) {
        if (notif?.id) {
          notifMap.set(notif.id, notif);
        }
      }
      store.notifications = Array.from(notifMap.values());
    }

    if (Array.isArray(payload.activityLogs) && payload.activityLogs.length > 0) {
      const logMap = new Map(store.activityLogs.map((l) => [l.id, l]));
      for (const log of payload.activityLogs) {
        if (log?.id) {
          logMap.set(log.id, log);
        }
      }
      store.activityLogs = Array.from(logMap.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 200);
    }

    saveStore(store);
    res.json({
      ok: true,
      counts: {
        classes: store.classes.length,
        lessons: store.lessons.length,
        submissions: store.submissions.length,
      },
    });
  });

  // Reuse an existing lesson across additional classes + push notification
  app.post('/api/lessons/:id/assign', (req, res) => {
    const lessonId = req.params.id;
    const { classIds } = req.body as { classIds: string[] };
    const store = loadStore();
    const lesson = store.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Không tìm thấy bài học.' });
      return;
    }

    const previous = new Set(lesson.assignedClassIds);
    const nextList = Array.from(new Set(classIds ?? []));
    lesson.assignedClassIds = nextList;

    for (const cid of nextList) {
      if (!previous.has(cid)) {
        store.notifications.unshift({
          id: `notif-${Date.now()}-${cid}`,
          classId: cid,
          lessonId: lesson.id,
          title: `Bài tập mới: ${lesson.title}`,
          message: `Bài học "${lesson.title}" vừa được giao thêm cho lớp ${cid}!`,
          createdAt: new Date().toISOString(),
          readByGroupIds: [],
        });
      }
    }

    saveStore(store);
    res.json({ lesson });
  });

  app.delete('/api/lessons/:id', (req, res) => {
    const store = loadStore();
    store.lessons = store.lessons.filter((l) => l.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true });
  });

  // Shared helper to grade one submission
  async function gradeSubmissionItem(
    item: {
      classId: string;
      tabletNumber: number;
      groupName: string;
      lessonId: string;
      questionId: string;
      userAnswer: string;
      elapsedMs: number;
      submittedAt?: string;
    },
    lang: Language,
    syncedFromOffline = false,
  ): Promise<AnswerSubmission | null> {
    const store = loadStore();
    const lesson = store.lessons.find((l) => l.id === item.lessonId);
    const question = lesson?.questions.find((q) => q.id === item.questionId);
    if (!lesson || !question) {
      return null;
    }

    const groupId = formatGroupId(item.tabletNumber, item.groupName);
    const comp = getCompetencyById(question.competencyId);
    const compName = `${comp.id}. ${lang === 'vi' ? comp.nameVi : comp.nameEn}`;

    let isCorrect = isAnswerMatch(
      item.userAnswer,
      question.correctAnswer ?? '',
      question.type,
    );
    let feedbackText = '';
    let explanation = question.explanation;

    if (question.type === 'short_answer' && process.env.GEMINI_API_KEY) {
      try {
        const aiGrade = await evaluateShortAnswerWithAI({
          questionText: question.questionText,
          correctAnswer: question.correctAnswer ?? '',
          userAnswer: item.userAnswer,
          competencyName: compName,
          groupName: item.groupName,
          language: lang,
        });
        isCorrect = aiGrade.isCorrect;
        feedbackText = aiGrade.feedbackText;
        explanation = aiGrade.explanation;
      } catch {
        // Fallback smoothly to deterministic feedback if AI grading call drops
      }
    }

    const breakdown = calculatePoints(isCorrect, item.elapsedMs);

    if (!feedbackText) {
      if (lang === 'en') {
        feedbackText = isCorrect
          ? breakdown.speedBonus >= 35
            ? `Lightning fast, ${item.groupName}! +${breakdown.totalPoints} pts (including +${breakdown.speedBonus} speed bonus)!`
            : `Spot on, ${item.groupName}! +${breakdown.totalPoints} pts!`
          : `Nice try, ${item.groupName}! Check the Digital Citizen tip below and keep going!`;
      } else {
        feedbackText = isCorrect
          ? breakdown.speedBonus >= 35
            ? `Quá nhanh quá nguy hiểm! Nhóm ${item.groupName} ghi ngay +${breakdown.totalPoints} điểm (gồm +${breakdown.speedBonus} điểm tốc độ)!`
            : `Chính xác tuyệt đối! Chúc mừng nhóm ${item.groupName} nhận +${breakdown.totalPoints} điểm!`
          : `Suýt đúng rồi ${item.groupName} ơi! Xem bí kíp Công dân số bên dưới để ghi điểm câu sau nhé!`;
      }
    }

    const submission: AnswerSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      classId: item.classId,
      groupId,
      tabletNumber: item.tabletNumber,
      groupName: item.groupName,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      questionId: question.id,
      competencyId: question.competencyId,
      competencyIds: question.competencyIds ?? [question.competencyId],
      userAnswer: item.userAnswer,
      isCorrect,
      basePoints: breakdown.basePoints,
      speedBonus: breakdown.speedBonus,
      totalPoints: breakdown.totalPoints,
      elapsedMs: item.elapsedMs,
      submittedAt: item.submittedAt || new Date().toISOString(),
      feedbackText,
      explanation,
      syncedFromOffline,
    };

    // Replace earlier attempt for the same group + question + lesson so retries update cleanly or keep best
    const existingIdx = store.submissions.findIndex(
      (s) =>
        s.classId === submission.classId &&
        s.groupId === submission.groupId &&
        s.lessonId === submission.lessonId &&
        s.questionId === submission.questionId,
    );
    if (existingIdx >= 0) {
      store.submissions[existingIdx] = submission;
    } else {
      store.submissions.push(submission);
    }

    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      classId: submission.classId,
      groupId: submission.groupId,
      action: syncedFromOffline
        ? isCorrect
          ? 'Đồng bộ ngoại tuyến · Đúng'
          : 'Đồng bộ ngoại tuyến · Chưa đúng'
        : isCorrect
          ? 'Trả lời đúng'
          : 'Trả lời chưa đúng',
      detail: `Năng lực ${comp.id} (${comp.nameVi}) · ${(submission.elapsedMs / 1000).toFixed(1)}s`,
      competencyId: submission.competencyId,
      pointsDelta: submission.totalPoints,
      timestamp: submission.submittedAt,
    };
    store.activityLogs.unshift(log);

    saveStore(store);
    return submission;
  }

  // Step 3: Submit single answer
  app.post('/api/quiz/submit', async (req, res) => {
    const body = req.body as {
      classId: string;
      tabletNumber: number;
      groupName: string;
      lessonId: string;
      questionId: string;
      userAnswer: string;
      elapsedMs: number;
      lang?: Language;
    };

    if (!body.classId || !body.tabletNumber || !body.lessonId || !body.questionId) {
      res.status(400).json({ error: 'Thiếu thông tin Lớp học hoặc Số máy.' });
      return;
    }

    const submission = await gradeSubmissionItem(
      body,
      body.lang === 'en' ? 'en' : 'vi',
      false,
    );

    if (!submission) {
      res.status(404).json({ error: 'Không tìm thấy câu hỏi tương ứng.' });
      return;
    }

    const store = loadStore();
    const leaderboard = buildLeaderboard(
      body.classId,
      store.submissions,
      body.lang === 'en' ? 'en' : 'vi',
    );

    res.json({ submission, leaderboard });
  });

  // Sync queued offline answers
  app.post('/api/quiz/sync', async (req, res) => {
    const { items, lang } = req.body as {
      items: OfflineQueueItem[];
      lang?: Language;
    };

    const synced: AnswerSubmission[] = [];
    for (const item of items ?? []) {
      const result = await gradeSubmissionItem(
        item,
        lang === 'en' ? 'en' : 'vi',
        true,
      );
      if (result) {
        synced.push(result);
      }
    }

    const store = loadStore();
    const classId = items?.[0]?.classId || store.classes[0]?.id || 'LOP-5A';
    const leaderboard = buildLeaderboard(
      classId,
      store.submissions,
      lang === 'en' ? 'en' : 'vi',
    );

    res.json({ synced, leaderboard });
  });

  app.post('/api/notifications/read', (req, res) => {
    const { notificationId, groupId } = req.body as {
      notificationId: string;
      groupId: string;
    };
    const store = loadStore();
    const target = store.notifications.find((n) => n.id === notificationId);
    if (target && groupId && !target.readByGroupIds.includes(groupId)) {
      target.readByGroupIds.push(groupId);
      saveStore(store);
    }
    res.json({ ok: true });
  });

  // Structured Step 4 API Export (ClassID, GroupID, Score, Rank, SkillLevel)
  app.get('/api/export', (req, res) => {
    const store = loadStore();
    const classId =
      typeof req.query.classId === 'string' && req.query.classId
        ? req.query.classId
        : store.classes[0]?.id || 'LOP-5A';
    const lang = (req.query.lang === 'en' ? 'en' : 'vi') as Language;
    const leaderboard = buildLeaderboard(classId, store.submissions, lang);

    res.json({
      exportedAt: new Date().toISOString(),
      ClassID: classId,
      rankings: leaderboard.map((row) => ({
        ClassID: row.ClassID,
        GroupID: row.GroupID,
        Score: row.Score,
        Rank: row.Rank,
        SkillLevel: row.SkillLevel,
        AccuracyPercent: row.accuracyPercent,
        AvgTimeSeconds: Number((row.avgElapsedMs / 1000).toFixed(1)),
      })),
    });
  });

  // Always respond with JSON for unmatched or failing /api/* requests so clients never receive HTML <!doctype>
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint không tồn tại trên máy chủ.' });
  });

  app.use(
    '/api',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const message =
        err instanceof Error ? err.message : 'Lỗi xử lý trên máy chủ.';
      res.status(status).json({ error: message });
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduBot Digital Citizen running on http://localhost:${PORT}`);
  });
}

startServer();
