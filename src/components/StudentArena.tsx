import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HelpCircle,
  Search,
  Send,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { getCompetencyById, getDomainByCompetencyId } from '../shared/competencies';
import { CopyDict } from '../shared/i18n';
import {
  AnswerSubmission,
  Language,
  Lesson,
  OfflineQueueItem,
  PushNotification,
  Question,
  SessionIdentity,
  UiMode,
} from '../shared/types';

interface StudentArenaProps {
  session: SessionIdentity | null;
  lessons: Lesson[];
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string | null) => void;
  notifications: PushNotification[];
  onGoToIdentity: () => void;
  onGoToHonorBoard: () => void;
  isOfflineEffective: boolean;
  onOnlineSubmission: (submission: AnswerSubmission) => void;
  onQueueOffline: (item: OfflineQueueItem) => void;
  copy: CopyDict;
  lang: Language;
  uiMode: UiMode;
}

interface LocalFeedbackState {
  isOfflineQueued: boolean;
  isCorrect?: boolean;
  totalPoints?: number;
  speedBonus?: number;
  feedbackText: string;
  explanation?: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function StudentArena({
  session,
  lessons,
  selectedLessonId,
  onSelectLesson,
  notifications,
  onGoToIdentity,
  onGoToHonorBoard,
  isOfflineEffective,
  onOnlineSubmission,
  onQueueOffline,
  copy,
  lang,
  uiMode,
}: StudentArenaProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedHint, setCopiedHint] = useState(false);
  const [feedback, setFeedback] = useState<LocalFeedbackState | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  const activeLesson =
    lessons.find((l) => l.id === selectedLessonId) ?? null;

  const classLessons = session
    ? lessons.filter((l) => l.assignedClassIds.includes(session.classId))
    : lessons;

  const currentQuestion: Question | null =
    activeLesson && activeLesson.questions[questionIndex]
      ? activeLesson.questions[questionIndex]
      : null;

  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setSelectedOption('');
    setTextAnswer('');
    setFeedback(null);
    setCopiedHint(false);
  }, [selectedLessonId, questionIndex]);

  useEffect(() => {
    if (!currentQuestion || feedback) return;
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 200);
    return () => window.clearInterval(interval);
  }, [currentQuestion, feedback]);

  if (!session) {
    return (
      <section className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
        <HelpCircle className="w-10 h-10 text-sky-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          {lang === 'vi'
            ? 'Cần định danh Lớp & Máy tính bảng trước khi chơi'
            : 'Please check in your Class & Tablet first'}
        </h2>
        <p className="text-sm text-slate-600">
          {lang === 'vi'
            ? 'Hệ thống luôn kiểm tra Mã lớp và Số máy (01–10) ở Bước 1 để đảm bảo điểm số không bị lẫn giữa các tiết học.'
            : 'Step 1 verifies your Class Code and Tablet number (01–10) before starting any quiz.'}
        </p>
        <button
          type="button"
          onClick={onGoToIdentity}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer"
        >
          <span>{lang === 'vi' ? 'Đi tới Bước 1: Vào lớp' : 'Go to Step 1: Check-In'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    );
  }

  // Lesson Mission Picker View
  if (!activeLesson || !currentQuestion) {
    const unreadNotifs = notifications.filter(
      (n) =>
        n.classId === session.classId &&
        !n.readByGroupIds.includes(session.groupId),
    );

    return (
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {session.classId} · {session.groupId}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {lang === 'vi'
                ? 'Nhiệm Vụ Công Dân Số Của Lớp'
                : 'Class Digital Citizen Missions'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGoToHonorBoard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-600" />
              <span>{copy.finishLeaderboardBtn}</span>
            </button>
          </div>
        </div>

        {unreadNotifs.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-sky-800">
                {copy.newAssignmentBanner}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {unreadNotifs[0].title}
              </p>
              <p className="text-sm text-slate-600">{unreadNotifs[0].message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuestionIndex(0);
                setSessionScore(0);
                onSelectLesson(unreadNotifs[0].lessonId);
              }}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'vi' ? 'Chơi ngay bài mới' : 'Play New Mission'}
            </button>
          </div>
        )}

        {classLessons.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-base font-semibold text-slate-900">
              {lang === 'vi'
                ? `Lớp ${session.classId} chưa có bài học nào được giao`
                : `No lessons assigned to ${session.classId} yet`}
            </h2>
            <p className="text-sm text-slate-500">
              {lang === 'vi'
                ? 'Giáo viên có thể tải tài liệu bài học hoặc giao bài có sẵn tại mục Giáo viên.'
                : 'Teachers can upload a lesson or assign existing lessons in Teacher Studio.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {classLessons.map((lesson) => {
              const uniqueDomains = Array.from(
                new Set(
                  lesson.questions.map(
                    (q) => getDomainByCompetencyId(q.competencyId).number,
                  ),
                ),
              );
              return (
                <article
                  key={lesson.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-sky-700">
                        {lesson.questions.length}{' '}
                        {lang === 'vi' ? 'câu hỏi' : 'questions'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {lang === 'vi' ? 'Nhóm năng lực' : 'Domains'}{' '}
                        {uniqueDomains.join(', ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{lesson.sourceFileName}</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 text-balance">
                      {lesson.title}
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {lesson.summary}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500 truncate">
                      {lesson.topic}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionIndex(0);
                        setSessionScore(0);
                        onSelectLesson(lesson.id);
                      }}
                      className={`inline-flex items-center gap-2 px-5 font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl whitespace-nowrap shrink-0 cursor-pointer ${
                        uiMode === 'kid' ? 'py-3 text-base' : 'py-2 text-sm'
                      }`}
                    >
                      <span>{lang === 'vi' ? 'Bắt đầu chơi' : 'Start Quiz'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // Active Question Play Stage (Step 3)
  const totalQ = activeLesson.questions.length;
  const comp = getCompetencyById(currentQuestion.competencyId);
  const domain = getDomainByCompetencyId(currentQuestion.competencyId);
  const answerValue =
    currentQuestion.type === 'multiple_choice' ? selectedOption : textAnswer;
  const isLastQuestion = questionIndex >= totalQ - 1;

  const handleCopyKeyword = async () => {
    try {
      await navigator.clipboard.writeText(currentQuestion.aiSearchKeywordHint);
      setCopiedHint(true);
      window.setTimeout(() => setCopiedHint(false), 2000);
    } catch {
      setCopiedHint(true);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerValue.trim() || submitting || feedback) return;

    const finalElapsed = Math.max(500, Date.now() - startTimeRef.current);
    setSubmitting(true);

    if (isOfflineEffective) {
      const queueItem: OfflineQueueItem = {
        localId: `off-${Date.now()}`,
        classId: session.classId,
        groupId: session.groupId,
        tabletNumber: session.tabletNumber,
        groupName: session.groupName,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        questionId: currentQuestion.id,
        competencyId: currentQuestion.competencyId,
        competencyIds: currentQuestion.competencyIds ?? [currentQuestion.competencyId],
        userAnswer: answerValue.trim(),
        elapsedMs: finalElapsed,
        submittedAt: new Date().toISOString(),
      };
      onQueueOffline(queueItem);
      setFeedback({
        isOfflineQueued: true,
        feedbackText:
          lang === 'vi'
            ? `Đã lưu tạm đáp án của nhóm ${session.groupName} (${(finalElapsed / 1000).toFixed(1)}s). Khi mạng ổn định hệ thống sẽ tự động chấm và đồng bộ lên bảng xếp hạng!`
            : `Saved ${session.groupName}'s answer offline (${(finalElapsed / 1000).toFixed(1)}s). It will auto-sync once connected!`,
      });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: session.classId,
          tabletNumber: session.tabletNumber,
          groupName: session.groupName,
          lessonId: activeLesson.id,
          questionId: currentQuestion.id,
          userAnswer: answerValue.trim(),
          elapsedMs: finalElapsed,
          lang,
        }),
      });

      if (!res.ok) {
        throw new Error('Network error');
      }

      const { readJsonSafe } = await import('../utils/safeJson');
      const data = await readJsonSafe<{ submission: AnswerSubmission }>(res, lang);
      if (!data.submission) {
        throw new Error('Invalid server response');
      }
      onOnlineSubmission(data.submission);
      setSessionScore((prev) => prev + data.submission.totalPoints);
      setFeedback({
        isOfflineQueued: false,
        isCorrect: data.submission.isCorrect,
        totalPoints: data.submission.totalPoints,
        speedBonus: data.submission.speedBonus,
        feedbackText: data.submission.feedbackText,
        explanation: data.submission.explanation,
      });
    } catch {
      // Automatic fallback to offline queue if request drops mid-flight!
      const queueItem: OfflineQueueItem = {
        localId: `off-${Date.now()}`,
        classId: session.classId,
        groupId: session.groupId,
        tabletNumber: session.tabletNumber,
        groupName: session.groupName,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        questionId: currentQuestion.id,
        competencyId: currentQuestion.competencyId,
        competencyIds: currentQuestion.competencyIds ?? [currentQuestion.competencyId],
        userAnswer: answerValue.trim(),
        elapsedMs: finalElapsed,
        submittedAt: new Date().toISOString(),
      };
      onQueueOffline(queueItem);
      setFeedback({
        isOfflineQueued: true,
        feedbackText:
          lang === 'vi'
            ? 'Mạng vừa bị gián đoạn — Đáp án đã được lưu an toàn ngoại tuyến để đồng bộ sau!'
            : 'Connection dropped — Answer safely stored offline for auto-sync!',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onSelectLesson(null);
      onGoToHonorBoard();
    } else {
      setQuestionIndex((i) => i + 1);
    }
  };

  return (
    <section className="max-w-4xl mx-auto space-y-5">
      {/* Top Progress & Session Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectLesson(null)}
              className="font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              {lang === 'vi' ? '← Đổi bài học' : '← All Lessons'}
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-900 truncate max-w-xs sm:max-w-md">
              {activeLesson.title}
            </span>
          </div>

          <div className="flex items-center gap-4 tabular-nums">
            <span className="inline-flex items-center gap-1.5 font-mono-num font-semibold text-slate-900">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>{(elapsedMs / 1000).toFixed(1)}s</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-sky-700">
              {lang === 'vi' ? `Điểm lượt này: ${sessionScore}` : `Score: ${sessionScore}`}
            </span>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 transition-transform duration-200"
            style={{
              width: `${Math.round(((questionIndex + 1) / totalQ) * 100)}%`,
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-800 tabular-nums">
            {lang === 'vi'
              ? `Câu ${questionIndex + 1} / ${totalQ}`
              : `Question ${questionIndex + 1} / ${totalQ}`}
          </span>
          <span className={`font-semibold ${domain.textClass}`}>
            {(() => {
              const ids =
                currentQuestion.competencyIds && currentQuestion.competencyIds.length > 0
                  ? currentQuestion.competencyIds
                  : [currentQuestion.competencyId];
              const names = ids
                .map((id) => {
                  const c = getCompetencyById(id);
                  return `${c.id} (${lang === 'vi' ? c.nameVi : c.nameEn})`;
                })
                .join(' · ');
              return lang === 'vi'
                ? `Năng lực: ${names}`
                : `Competencies: ${names}`;
            })()}
          </span>
        </div>
      </div>

      {/* Main Question Stage */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <h2
          className={`font-bold text-slate-900 leading-snug text-balance ${
            uiMode === 'kid' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
          }`}
        >
          {currentQuestion.questionText}
        </h2>

        {/* AI Search Keyword Hint Card (Core EduBot Feature) */}
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
              <Search className="w-4 h-4" />
              <span>{copy.aiHintTitle}</span>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              “{currentQuestion.aiSearchKeywordHint}”
            </p>
            <p className="text-xs text-slate-600">{copy.aiHintHelp}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyKeyword}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedHint ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{copy.copiedLabel}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{copy.copyKeywordBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* Answer Input Form */}
        <form onSubmit={handleSubmitAnswer} className="space-y-5">
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQuestion.options.map((opt, idx) => {
                const chosen = selectedOption === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => setSelectedOption(opt)}
                    className={`text-left rounded-xl border transition-colors flex items-start gap-3 cursor-pointer disabled:cursor-default ${
                      uiMode === 'kid' ? 'p-4 min-h-[60px]' : 'p-3.5 min-h-[52px]'
                    } ${
                      chosen
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'bg-white border-slate-200 hover:border-sky-400 text-slate-800'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        chosen
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {OPTION_LABELS[idx] ?? idx + 1}
                    </span>
                    <span
                      className={`font-medium leading-snug ${
                        uiMode === 'kid' ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="open-answer-input"
                className="block text-sm font-semibold text-slate-700"
              >
                {currentQuestion.type === 'fill_blank'
                  ? lang === 'vi'
                    ? 'Nhập từ còn thiếu vào chỗ trống:'
                    : 'Type the missing word:'
                  : lang === 'vi'
                    ? 'Nhập câu trả lời của nhóm sau khi tra cứu AI:'
                    : 'Type your team’s answer after researching:'}
              </label>
              <textarea
                id="open-answer-input"
                rows={currentQuestion.type === 'short_answer' ? 3 : 2}
                disabled={Boolean(feedback)}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Gõ câu trả lời của nhóm tại đây...'
                    : 'Enter your answer here...'
                }
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
              />
            </div>
          )}

          {!feedback && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={onGoToHonorBoard}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                {copy.finishLeaderboardBtn}
              </button>

              <button
                type="submit"
                disabled={!answerValue.trim() || submitting}
                className={`inline-flex items-center gap-2 px-6 font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-xl transition-colors cursor-pointer ${
                  uiMode === 'kid' ? 'py-3.5 text-base' : 'py-2.5 text-sm'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitting
                    ? lang === 'vi'
                      ? 'Đang chấm điểm...'
                      : 'Grading...'
                    : copy.submitAnswerBtn}
                </span>
              </button>
            </div>
          )}
        </form>

        {/* Feedback Banner after Submitting */}
        {feedback && (
          <div
            role="status"
            className={`rounded-xl border p-5 space-y-3 ${
              feedback.isOfflineQueued
                ? 'bg-amber-50 border-amber-200'
                : feedback.isCorrect
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-base">
                {feedback.isOfflineQueued ? (
                  <>
                    <WifiOff className="w-5 h-5 text-amber-700" />
                    <span className="text-amber-900">
                      {lang === 'vi'
                        ? 'Đã lưu ngoại tuyến (Chờ đồng bộ)'
                        : 'Saved Offline (Pending Sync)'}
                    </span>
                  </>
                ) : feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span className="text-emerald-900">
                      {lang === 'vi' ? 'Chính xác!' : 'Correct!'}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-700" />
                    <span className="text-rose-900">
                      {lang === 'vi' ? 'Chưa chính xác' : 'Not quite right'}
                    </span>
                  </>
                )}
              </div>

              {!feedback.isOfflineQueued && (
                <span className="font-mono-num text-sm font-bold text-slate-900">
                  +{feedback.totalPoints ?? 0}{' '}
                  {lang === 'vi' ? 'điểm' : 'pts'}
                  {(feedback.speedBonus ?? 0) > 0 &&
                    ` (+${feedback.speedBonus} ${lang === 'vi' ? 'tốc độ' : 'speed'})`}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {feedback.feedbackText}
            </p>

            {feedback.explanation && (
              <p className="text-xs sm:text-sm text-slate-700 pt-2 border-t border-black/10 leading-relaxed">
                <strong className="font-semibold">
                  {lang === 'vi' ? 'Giải thích Công dân số: ' : 'Digital Citizen Note: '}
                </strong>
                {feedback.explanation}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <span>
                  {isLastQuestion ? copy.finishLeaderboardBtn : copy.nextQuestionBtn}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
