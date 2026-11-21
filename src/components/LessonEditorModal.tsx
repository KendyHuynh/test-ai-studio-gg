import { useState } from 'react';
import { Check, Plus, Save, Trash2, X } from 'lucide-react';
import { COMPETENCIES_24 } from '../shared/competencies';
import {
  ClassRoom,
  Language,
  Lesson,
  Question,
  QuestionType,
} from '../shared/types';

interface LessonEditorModalProps {
  lesson: Lesson;
  classes: ClassRoom[];
  lang: Language;
  onClose: () => void;
  onSave: (updatedLesson: Lesson) => Promise<void>;
}

function createEmptyQuestion(index: number, lessonId: string): Question {
  return {
    id: `${lessonId}-q${Date.now()}-${index}`,
    type: 'multiple_choice',
    questionText: '',
    options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
    aiSearchKeywordHint: 'công dân số TT 02/2025',
    correctAnswer: 'Lựa chọn A',
    competencyId: '1.1',
    competencyIds: ['1.1'],
    explanation: '',
  };
}

export function LessonEditorModal({
  lesson,
  classes,
  lang,
  onClose,
  onSave,
}: LessonEditorModalProps) {
  const [title, setTitle] = useState(lesson.title);
  const [topic, setTopic] = useState(lesson.topic);
  const [summary, setSummary] = useState(lesson.summary);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>(
    lesson.assignedClassIds ?? [],
  );
  const [questions, setQuestions] = useState<Question[]>(() =>
    lesson.questions.map((q) => ({
      ...q,
      options: q.options ? [...q.options] : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
      competencyIds:
        q.competencyIds && q.competencyIds.length > 0
          ? [...q.competencyIds]
          : [q.competencyId || '1.1'],
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleClass = (cid: string) => {
    setAssignedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    );
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const handleTypeChange = (idx: number, nextType: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const opts =
          q.options && q.options.length >= 2
            ? q.options
            : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'];
        return {
          ...q,
          type: nextType,
          options: nextType === 'multiple_choice' ? opts : undefined,
          correctAnswer:
            nextType === 'multiple_choice'
              ? opts.includes(q.correctAnswer ?? '')
                ? q.correctAnswer
                : opts[0]
              : q.correctAnswer ?? '',
        };
      }),
    );
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const oldVal = q.options?.[optIdx] ?? '';
        const nextOpts = [...(q.options ?? ['', '', '', ''])];
        nextOpts[optIdx] = value;
        const nextCorrect =
          q.correctAnswer === oldVal ? value : q.correctAnswer;
        return { ...q, options: nextOpts, correctAnswer: nextCorrect };
      }),
    );
  };

  const toggleQuestionCompetency = (qIdx: number, compId: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const current = q.competencyIds ?? [q.competencyId];
        const exists = current.includes(compId);
        let next = exists
          ? current.filter((c) => c !== compId)
          : [...current, compId];
        if (next.length === 0) next = [compId];
        return {
          ...q,
          competencyIds: next,
          competencyId: next[0],
        };
      }),
    );
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      createEmptyQuestion(prev.length + 1, lesson.id),
    ]);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(
        lang === 'vi'
          ? 'Vui lòng nhập tên bài học.'
          : 'Lesson title is required.',
      );
      return;
    }

    const invalidIdx = questions.findIndex(
      (q) => !q.questionText.trim() || !(q.correctAnswer ?? '').trim(),
    );
    if (invalidIdx >= 0) {
      setError(
        lang === 'vi'
          ? `Câu hỏi số ${invalidIdx + 1} cần có đủ nội dung và đáp án đúng.`
          : `Question #${invalidIdx + 1} needs both question text and correct answer.`,
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(lesson.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          topic: topic.trim(),
          summary: summary.trim(),
          assignedClassIds,
          questions,
        }),
      });
      const { readJsonSafe } = await import('../utils/safeJson');
      const data = await readJsonSafe<{ lesson?: Lesson; error?: string }>(res, lang);
      if (!res.ok || !data.lesson) {
        throw new Error(data.error || 'Không thể lưu chỉnh sửa bài học.');
      }
      await onSave(data.lesson);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Lỗi khi lưu bài học.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-editor-title"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div>
            <h2
              id="lesson-editor-title"
              className="text-lg font-bold text-slate-900"
            >
              {lang === 'vi'
                ? `Chỉnh sửa bài học & Bộ câu hỏi (${questions.length} câu)`
                : `Edit Lesson & Questions (${questions.length})`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'Chỉnh sửa nội dung, đáp án, gợi ý từ khóa AI và ánh xạ 24 năng lực Công dân số.'
                : 'Edit question wording, correct answers, AI keyword hints, and competency mappings.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-lesson-title"
                className="block text-xs font-semibold text-slate-700"
              >
                {lang === 'vi' ? 'Tên bài học' : 'Lesson Title'}
              </label>
              <input
                id="edit-lesson-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-lesson-topic"
                className="block text-xs font-semibold text-slate-700"
              >
                {lang === 'vi' ? 'Chủ đề chính' : 'Topic'}
              </label>
              <input
                id="edit-lesson-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="edit-lesson-summary"
                className="block text-xs font-semibold text-slate-700"
              >
                {lang === 'vi' ? 'Tóm tắt bài học' : 'Lesson Summary'}
              </label>
              <textarea
                id="edit-lesson-summary"
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">
                {lang === 'vi' ? 'Giao cho các lớp:' : 'Assigned Classes:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const active = assignedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      <span>{c.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Questions list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'vi'
                  ? `Danh sách câu hỏi (${questions.length} câu)`
                  : `Questions (${questions.length})`}
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Thêm câu hỏi mới' : 'Add Question'}</span>
              </button>
            </div>

            {questions.map((q, qIdx) => {
              const selectedComps = q.competencyIds ?? [q.competencyId];
              return (
                <div
                  key={q.id || qIdx}
                  className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-sky-700 font-mono-num">
                      {lang === 'vi' ? `CÂU ${qIdx + 1}` : `QUESTION ${qIdx + 1}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <select
                        value={q.type}
                        onChange={(e) =>
                          handleTypeChange(qIdx, e.target.value as QuestionType)
                        }
                        className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="multiple_choice">
                          {lang === 'vi' ? 'Trắc nghiệm' : 'Multiple Choice'}
                        </option>
                        <option value="fill_blank">
                          {lang === 'vi' ? 'Điền khuyết' : 'Fill in the Blank'}
                        </option>
                        <option value="short_answer">
                          {lang === 'vi' ? 'Câu hỏi ngắn' : 'Short Answer'}
                        </option>
                      </select>

                      <button
                        type="button"
                        disabled={questions.length <= 1}
                        onClick={() => handleDeleteQuestion(qIdx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Xóa câu' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      {lang === 'vi' ? 'Nội dung câu hỏi' : 'Question Text'}
                    </label>
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) =>
                        updateQuestion(qIdx, { questionText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>

                  {q.type === 'multiple_choice' ? (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-slate-700">
                        {lang === 'vi'
                          ? '4 Phương án & Chọn đáp án đúng:'
                          : 'Options & Select Correct Answer:'}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(q.options ?? ['', '', '', '']).map((opt, optIdx) => {
                          const isCorrectOpt = q.correctAnswer === opt && opt.trim() !== '';
                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-1.5 rounded-xl border ${
                                isCorrectOpt
                                  ? 'border-emerald-400 bg-emerald-50/50'
                                  : 'border-slate-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${q.id}-${qIdx}`}
                                checked={isCorrectOpt}
                                onChange={() =>
                                  updateQuestion(qIdx, { correctAnswer: opt })
                                }
                                title={lang === 'vi' ? 'Đánh dấu đáp án đúng' : 'Mark as correct'}
                                className="ml-1.5 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                  updateOption(qIdx, optIdx, e.target.value)
                                }
                                placeholder={`Phương án ${String.fromCharCode(65 + optIdx)}`}
                                className="flex-1 px-2 py-1 text-sm bg-transparent focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        {lang === 'vi' ? 'Đáp án đúng' : 'Correct Answer'}
                      </label>
                      <input
                        type="text"
                        value={q.correctAnswer ?? ''}
                        onChange={(e) =>
                          updateQuestion(qIdx, { correctAnswer: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-emerald-300 bg-emerald-50/40 rounded-xl"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        {lang === 'vi' ? 'Gợi ý từ khóa tìm kiếm AI' : 'AI Search Keyword Hint'}
                      </label>
                      <input
                        type="text"
                        value={q.aiSearchKeywordHint}
                        onChange={(e) =>
                          updateQuestion(qIdx, { aiSearchKeywordHint: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        {lang === 'vi' ? 'Giải thích đáp án' : 'Explanation'}
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) =>
                          updateQuestion(qIdx, { explanation: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700">
                      {lang === 'vi'
                        ? `Năng lực TT 02/2025 (${selectedComps.join(', ')})`
                        : `Competencies (${selectedComps.join(', ')})`}
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {COMPETENCIES_24.map((c) => {
                        const active = selectedComps.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleQuestionCompetency(qIdx, c.id)}
                            className={`px-2 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                              active
                                ? 'bg-sky-600 border-sky-600 text-white font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {c.id} {c.nameVi}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving
                ? lang === 'vi'
                  ? 'Đang lưu...'
                  : 'Saving...'
                : lang === 'vi'
                  ? 'Lưu thay đổi bài học'
                  : 'Save Lesson Changes'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
