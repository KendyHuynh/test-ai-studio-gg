import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  BookOpen,
  Check,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  FolderOpen,
  History,
  LayoutGrid,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { COMPETENCIES_24, COMPETENCY_DOMAINS, getCompetencyById } from '../shared/competencies';
import { CopyDict } from '../shared/i18n';
import { CompetencyCoverageStat } from '../shared/scoring';
import {
  ActivityLog,
  AnswerSubmission,
  ClassRoom,
  Language,
  Lesson,
  PushNotification,
} from '../shared/types';
import {
  defaultShareCodeForUid,
  deleteClassFromFirestore,
  deleteLessonFromFirestore,
  fetchTeacherCloudData,
  publishPublicWorkspace,
  pushWorkspaceToFirestore,
  saveClassToFirestore,
  saveLessonToFirestore,
  syncUserProfileToFirestore,
  testFirestoreConnection,
} from '../utils/firestoreSync';
import { formatFirebaseAuthError } from '../utils/authErrors';
import {
  auth,
  firebaseGoogleSignIn,
  logoutGoogle,
} from '../utils/googleDrive';
import {
  buildStudentJoinUrl,
  buildTeacherPortalUrl,
  resolveShareableOrigin,
} from '../utils/routing';
import {
  parseJsonTextSafe,
  readJsonSafe,
} from '../utils/safeJson';
import { GoogleDrivePanel } from './GoogleDrivePanel';
import { LessonEditorModal } from './LessonEditorModal';

interface TeacherStudioProps {
  classes: ClassRoom[];
  lessons: Lesson[];
  competencyMatrix: CompetencyCoverageStat[];
  activityLogs: ActivityLog[];
  submissions?: AnswerSubmission[];
  notifications?: PushNotification[];
  sharedAppUrl?: string;
  selectedClassId: string;
  onRefreshData: () => Promise<void>;
  onSelectLessonForPlay: (lessonId: string) => void;
  onLockTeacherPortal: () => void;
  copy: CopyDict;
  lang: Language;
}

const SAMPLE_LESSON_TEXT = `Bài học: Công dân số thông minh & An toàn AI (TT 02/2025)
1. Khi tìm kiếm tài liệu học tập trên Internet, học sinh nên sử dụng từ khóa cụ thể kết hợp toán tử tìm kiếm và kiểm tra ít nhất 2 nguồn tin uy tín trước khi chia sẻ.
2. Tuyệt đối không chia sẻ mật khẩu, số điện thoại, địa chỉ nhà hoặc ảnh riêng tư cho người lạ trên mạng xã hội. Bật xác thực 2 bước (2FA) cho tài khoản học tập.
3. Khi sử dụng hình ảnh, bài viết của tác giả khác vào bài thuyết trình nhóm, cần ghi rõ nguồn trích dẫn để tôn trọng bản quyền.
4. Khi dùng công cụ AI hỗ trợ học tập, cần kiểm tra lại sự thật vì AI có thể mắc lỗi "ảo giác", đồng thời không sao chép nguyên văn bài làm của AI để nộp cho thầy cô.`;

export function TeacherStudio({
  classes,
  lessons,
  competencyMatrix,
  activityLogs,
  submissions = [],
  notifications = [],
  sharedAppUrl,
  selectedClassId,
  onRefreshData,
  onSelectLessonForPlay,
  onLockTeacherPortal,
  copy,
  lang,
}: TeacherStudioProps) {
  const [subTab, setSubTab] = useState<
    'generate' | 'drive' | 'classes' | 'matrix' | 'history'
  >('generate');

  // Lesson upload / AI generator form (default 15 questions)
  const [lessonTitle, setLessonTitle] = useState('');
  const [sourceFileName, setSourceFileName] = useState('TaiLieu_CongDanSo.txt');
  const [textContent, setTextContent] = useState('');
  const [base64Data, setBase64Data] = useState<string | undefined>(undefined);
  const [mimeType, setMimeType] = useState<string | undefined>(undefined);
  const [questionCount, setQuestionCount] = useState(15);
  const [targetClassIds, setTargetClassIds] = useState<string[]>([
    selectedClassId || classes[0]?.id || 'LOP-5A',
  ]);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  // Classroom create / edit / delete state
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Khối 5');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [classSaving, setClassSaving] = useState(false);
  const [classActionError, setClassActionError] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<{
    originalId: string;
    id: string;
    name: string;
    grade: string;
    teacherName: string;
  } | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  // Lesson editor & delete confirmation
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);

  // Firebase Firestore cloud sync state
  const [cloudUser, setCloudUser] = useState<User | null>(() => auth.currentUser);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [signingInCloud, setSigningInCloud] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
    suggestNewTab?: boolean;
  } | null>(null);
  const cloudSyncingRef = useRef(false);
  const hydratedUidRef = useRef<string | null>(null);

  const [jsonLessonId, setJsonLessonId] = useState<string | null>(null);
  const [revealJsonAnswer, setRevealJsonAnswer] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewTablet, setPreviewTablet] = useState<number>(0);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [transferStatus, setTransferStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const publishLatestPublicSnapshot = useCallback(
    async (uid: string) => {
      try {
        let nextClasses = classes;
        let nextLessons = lessons;
        try {
          const res = await fetch('/api/bootstrap?role=teacher');
          if (res.ok) {
            const latest = await readJsonSafe<{
              classes?: ClassRoom[];
              lessons?: Lesson[];
            }>(res, lang);
            if (latest.classes && latest.lessons) {
              nextClasses = latest.classes;
              nextLessons = latest.lessons;
            }
          }
        } catch {
          // Fall back to current in-memory classes & lessons if /api/bootstrap returns HTML
        }
        await publishPublicWorkspace(
          defaultShareCodeForUid(uid),
          uid,
          nextClasses,
          nextLessons,
        );
      } catch {
        // Non-fatal: private Firestore data still saved
      }
    },
    [classes, lang, lessons],
  );

  const syncWithCloud = useCallback(
    async (user: User, manual = false) => {
      if (cloudSyncingRef.current) return;
      cloudSyncingRef.current = true;
      setCloudSyncing(true);
      try {
        const connected = await testFirestoreConnection();
        if (!connected) {
          setCloudNotice({
            type: 'err',
            text:
              lang === 'vi'
                ? 'Firestore đang ngoại tuyến, dữ liệu vẫn được lưu trên máy chủ cục bộ.'
                : 'Firestore offline; using local server storage.',
          });
          return;
        }
        await syncUserProfileToFirestore(user);
        const cloudData = await fetchTeacherCloudData(user.uid);
        if (
          cloudData.classes.length > 0 ||
          cloudData.lessons.length > 0 ||
          cloudData.submissions.length > 0
        ) {
          await fetch('/api/sync/cloud-hydrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cloudData),
          });
          await onRefreshData();
        }
        await pushWorkspaceToFirestore(user.uid, {
          classes,
          lessons,
          submissions,
          notifications,
          activityLogs,
        });
        await publishLatestPublicSnapshot(user.uid);
        hydratedUidRef.current = user.uid;
        if (manual) {
          const code = defaultShareCodeForUid(user.uid);
          setCloudNotice({
            type: 'ok',
            text:
              lang === 'vi'
                ? `Đã đồng bộ ${classes.length} lớp, ${lessons.length} bài học & xuất bản mã chia sẻ ${code} cho học sinh!`
                : `Synced ${classes.length} classes, ${lessons.length} lessons & published share code ${code}!`,
          });
          window.setTimeout(() => setCloudNotice(null), 5000);
        }
      } catch (err) {
        setCloudNotice({
          type: 'err',
          text: err instanceof Error ? err.message : 'Lỗi đồng bộ Firestore.',
        });
      } finally {
        cloudSyncingRef.current = false;
        setCloudSyncing(false);
      }
    },
    [
      activityLogs,
      classes,
      lang,
      lessons,
      notifications,
      onRefreshData,
      publishLatestPublicSnapshot,
      submissions,
    ],
  );

  const syncWithCloudRef = useRef(syncWithCloud);
  useEffect(() => {
    syncWithCloudRef.current = syncWithCloud;
  }, [syncWithCloud]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      if (user && hydratedUidRef.current !== user.uid) {
        syncWithCloudRef.current(user, false);
      }
    });
    return () => unsub();
  }, []);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const shareOrigin = resolveShareableOrigin(origin, sharedAppUrl);
  const shareCode = cloudUser ? defaultShareCodeForUid(cloudUser.uid) : null;

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    } catch {
      // Clipboard may be restricted in headless contexts
    }
  };

  const handleExportWorkspace = async () => {
    try {
      setTransferStatus(null);
      let exportPayload: { exportedAt: string; classes: ClassRoom[]; lessons: Lesson[] };
      try {
        const res = await fetch('/api/workspace/export');
        if (!res.ok) throw new Error('Export fallback');
        exportPayload = await readJsonSafe<{
          exportedAt: string;
          classes: ClassRoom[];
          lessons: Lesson[];
        }>(res, lang);
      } catch {
        // Guaranteed client-side fallback if server endpoint isn't deployed on Share App yet
        exportPayload = {
          exportedAt: new Date().toISOString(),
          classes,
          lessons,
        };
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `edubot-cong-dan-so-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setTransferStatus({
        type: 'ok',
        text:
          lang === 'vi'
            ? 'Đã tải xuống file cấu hình Lớp & Bài học (.json). Hãy mở bản Share App và bấm "Nhập file (.json)".'
            : 'Downloaded workspace JSON. Import it inside your Share App Teacher Portal.',
      });
    } catch (err) {
      setTransferStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi xuất file JSON.',
      });
    }
  };

  const handleImportWorkspaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTransferStatus(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = parseJsonTextSafe<Record<string, unknown>>(
          String(reader.result ?? '{}'),
          lang,
        );
        const res = await fetch('/api/workspace/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
        const data = await readJsonSafe<{
          ok?: boolean;
          importedClasses?: number;
          importedLessons?: number;
          error?: string;
        }>(res, lang);
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Tệp JSON không đúng định dạng.');
        }
        await onRefreshData();
        if (cloudUser) {
          await publishLatestPublicSnapshot(cloudUser.uid);
        }
        setTransferStatus({
          type: 'ok',
          text:
            lang === 'vi'
              ? `Đã nhập thành công ${data.importedClasses ?? 0} lớp học và ${data.importedLessons ?? 0} bài học!`
              : `Imported ${data.importedClasses ?? 0} classes & ${data.importedLessons ?? 0} lessons!`,
        });
      } catch (err) {
        setTransferStatus({
          type: 'err',
          text: err instanceof Error ? err.message : 'Không thể đọc tệp JSON.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFileName(file.name);
    if (!lessonTitle) {
      setLessonTitle(file.name.replace(/\.[^.]+$/, ''));
    }

    const isTextLike =
      file.type.startsWith('text/') ||
      /\.(txt|md|csv|json)$/i.test(file.name);

    const reader = new FileReader();
    if (isTextLike) {
      reader.onload = () => {
        setTextContent(String(reader.result ?? ''));
        setBase64Data(undefined);
        setMimeType(undefined);
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const commaIdx = result.indexOf(',');
        setBase64Data(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        setMimeType(file.type || 'application/pdf');
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleTargetClass = (cid: string) => {
    setTargetClassIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    );
  };

  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim() && !base64Data) {
      setGenStatus({
        type: 'err',
        text:
          lang === 'vi'
            ? 'Vui lòng tải lên tệp bài học hoặc dán nội dung bài học.'
            : 'Please upload a lesson file or paste lesson text.',
      });
      return;
    }

    setGenerating(true);
    setGenStatus(null);
    try {
      const res = await fetch('/api/lessons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lessonTitle.trim() || undefined,
          sourceFileName,
          textContent: textContent.trim() || undefined,
          base64Data,
          mimeType,
          questionCount,
          assignedClassIds: targetClassIds,
          language: lang,
        }),
      });
      const data = await readJsonSafe<{ lesson?: Lesson; error?: string }>(res, lang);
      if (!res.ok || !data.lesson) {
        throw new Error(data.error || 'Không thể tạo bài học.');
      }

      if (cloudUser) {
        await saveLessonToFirestore(data.lesson, cloudUser.uid);
        await publishLatestPublicSnapshot(cloudUser.uid);
      }
      await onRefreshData();
      setGenStatus({
        type: 'ok',
        text:
          lang === 'vi'
            ? `Đã tạo "${data.lesson.title}" (${data.lesson.questions.length} câu hỏi) và gửi thông báo đẩy tới lớp ${targetClassIds.join(', ')}!`
            : `Generated "${data.lesson.title}" (${data.lesson.questions.length} questions) and pushed alerts to ${targetClassIds.join(', ')}!`,
      });
      setLessonTitle('');
      setTextContent('');
      setBase64Data(undefined);
    } catch (err) {
      setGenStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi tạo câu hỏi AI.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleLessonClass = async (lesson: Lesson, cid: string) => {
    const exists = lesson.assignedClassIds.includes(cid);
    const nextIds = exists
      ? lesson.assignedClassIds.filter((x) => x !== cid)
      : [...lesson.assignedClassIds, cid];
    const res = await fetch(`/api/lessons/${lesson.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds: nextIds }),
    });
    if (res.ok && cloudUser) {
      try {
        const data = await readJsonSafe<{ lesson?: Lesson }>(res, lang);
        if (data.lesson) {
          await saveLessonToFirestore(data.lesson, cloudUser.uid);
          await publishLatestPublicSnapshot(cloudUser.uid);
        }
      } catch {
        // Non-fatal
      }
    }
    await onRefreshData();
  };

  const handleDeleteLesson = async (id: string) => {
    await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
    setConfirmDeleteLessonId(null);
    if (cloudUser) {
      await deleteLessonFromFirestore(id);
      await publishLatestPublicSnapshot(cloudUser.uid);
    }
    await onRefreshData();
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassCode.trim() || !newClassName.trim()) return;
    setClassSaving(true);
    setClassActionError(null);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newClassCode.trim(),
          name: newClassName.trim(),
          grade: newClassGrade.trim(),
          teacherName: newTeacherName.trim() || 'Giáo viên',
        }),
      });
      const data = await readJsonSafe<{ classRoom?: ClassRoom; error?: string }>(res, lang);
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu lớp học.');
      }
      if (cloudUser && data.classRoom) {
        await saveClassToFirestore(data.classRoom, cloudUser.uid);
        await publishLatestPublicSnapshot(cloudUser.uid);
      }
      setNewClassCode('');
      setNewClassName('');
      setNewTeacherName('');
      await onRefreshData();
    } catch (err) {
      setClassActionError(
        err instanceof Error ? err.message : 'Lỗi lưu lớp học.',
      );
    } finally {
      setClassSaving(false);
    }
  };

  const handleSaveEditedClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setClassSaving(true);
    setClassActionError(null);
    try {
      const res = await fetch(
        `/api/classes/${encodeURIComponent(editingClass.originalId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newId: editingClass.id.trim(),
            name: editingClass.name.trim(),
            grade: editingClass.grade.trim(),
            teacherName: editingClass.teacherName.trim(),
          }),
        },
      );
      const data = await readJsonSafe<{
        classRoom?: ClassRoom;
        oldId?: string;
        error?: string;
      }>(res, lang);
      if (!res.ok || !data.classRoom) {
        throw new Error(data.error || 'Không thể cập nhật lớp học.');
      }
      if (cloudUser) {
        if (data.oldId && data.oldId !== data.classRoom.id) {
          await deleteClassFromFirestore(data.oldId);
        }
        await saveClassToFirestore(data.classRoom, cloudUser.uid);
        await publishLatestPublicSnapshot(cloudUser.uid);
      }
      setEditingClass(null);
      await onRefreshData();
    } catch (err) {
      setClassActionError(
        err instanceof Error ? err.message : 'Lỗi cập nhật lớp học.',
      );
    } finally {
      setClassSaving(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    setClassActionError(null);
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(classId)}`, {
        method: 'DELETE',
      });
      const data = await readJsonSafe<{ ok?: boolean; error?: string }>(res, lang);
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa lớp học.');
      }
      setConfirmDeleteClassId(null);
      if (cloudUser) {
        await deleteClassFromFirestore(classId);
        await publishLatestPublicSnapshot(cloudUser.uid);
      }
      await onRefreshData();
    } catch (err) {
      setClassActionError(
        err instanceof Error ? err.message : 'Lỗi xóa lớp học.',
      );
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-sky-700">
            {lang === 'vi'
              ? 'Bước 2 & Quản trị · Giáo viên'
              : 'Step 2 & Admin · Teacher Studio'}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{copy.teacherTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('generate')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                subTab === 'generate'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Tạo bài học AI' : 'AI Lesson Gen'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('drive')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                subTab === 'drive'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Google Drive</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('classes')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                subTab === 'classes'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Lớp & Giao bài' : 'Classes & Reuse'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                subTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{lang === 'vi' ? '24 Năng lực' : '24 Competencies'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap ${
                subTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Lịch sử hoạt động' : 'Activity Log'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLockTeacherPortal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Khóa cổng GV' : 'Lock Portal'}</span>
          </button>
        </div>
      </div>

      {/* Persistent Cloud Storage (Firestore) Status Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {cloudUser ? (
              <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <CloudOff className="w-5 h-5 text-slate-400 shrink-0" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900">
                {cloudUser
                  ? lang === 'vi'
                    ? `Lưu trữ Đám mây Firestore đang bật (${cloudUser.email})`
                    : `Firestore Cloud Storage Active (${cloudUser.email})`
                  : lang === 'vi'
                    ? 'Dữ liệu đang lưu trên máy chủ web (Đăng nhập Google chỉ dành cho Giáo viên sao lưu Firestore)'
                    : 'Stored on web server (Teacher-only Google Sign-In for Firestore backup)'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {cloudUser && shareCode
                  ? lang === 'vi'
                    ? `Mã đồng bộ Share App: ${shareCode} · Học sinh KHÔNG cần đăng nhập Google hay kết nối Firebase.`
                    : `Share App Sync Code: ${shareCode} · Students NEVER need Google or Firebase login.`
                  : lang === 'vi'
                    ? 'Học sinh KHÔNG cần đăng nhập Google hay kết nối Firebase khi làm bài.'
                    : 'Students NEVER need Firebase or Google login to join and play.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cloudUser ? (
              <>
                <button
                  type="button"
                  disabled={cloudSyncing}
                  onClick={() => syncWithCloud(cloudUser, true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {cloudSyncing
                      ? lang === 'vi'
                        ? 'Đang đồng bộ...'
                        : 'Syncing...'
                      : lang === 'vi'
                        ? 'Đồng bộ Firestore ngay'
                        : 'Sync Firestore Now'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutGoogle();
                    setCloudUser(null);
                    hydratedUidRef.current = null;
                    setCloudNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đăng xuất' : 'Sign out'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={signingInCloud}
                onClick={async () => {
                  setSigningInCloud(true);
                  setCloudNotice(null);
                  try {
                    const res = await firebaseGoogleSignIn();
                    if (res?.user) {
                      await syncWithCloud(res.user, true);
                    }
                  } catch (err) {
                    const formatted = formatFirebaseAuthError(err, lang);
                    setCloudNotice({
                      type: 'err',
                      text: formatted.message,
                      suggestNewTab: formatted.suggestNewTab,
                    });
                  } finally {
                    setSigningInCloud(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-xl cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>
                  {signingInCloud
                    ? lang === 'vi'
                      ? 'Đang mở đăng nhập Google...'
                      : 'Signing in...'
                    : lang === 'vi'
                      ? 'Kết nối lưu trữ Cloud Firestore'
                      : 'Connect Cloud Firestore'}
                </span>
              </button>
            )}
          </div>
        </div>

        {cloudNotice && (
          <div
            role={cloudNotice.type === 'err' ? 'alert' : 'status'}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
              cloudNotice.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <span>{cloudNotice.text}</span>
            {cloudNotice.suggestNewTab && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sky-700 hover:underline whitespace-nowrap"
              >
                {lang === 'vi' ? 'Mở ở tab mới →' : 'Open in new tab →'}
              </a>
            )}
          </div>
        )}
      </div>

      {/* TAB: Google Drive Lesson Import & Backup */}
      {subTab === 'drive' && (
        <GoogleDrivePanel
          lessons={lessons}
          lang={lang}
          onImportLessonFile={(payload) => {
            setLessonTitle(payload.title);
            setSourceFileName(payload.fileName);
            setTextContent(payload.textContent ?? '');
            setBase64Data(payload.base64Data);
            setMimeType(payload.mimeType);
            setGenStatus({
              type: 'ok',
              text:
                lang === 'vi'
                  ? `Đã nạp "${payload.fileName}" từ Google Drive! Kiểm tra và bấm tạo câu hỏi AI.`
                  : `Imported "${payload.fileName}" from Google Drive! Ready to generate quiz.`,
            });
            setSubTab('generate');
          }}
        />
      )}

      {/* TAB 1: Upload Lesson & Generate AI Quiz */}
      {subTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleGenerateLesson}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {copy.uploadLessonTitle}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubTab('drive')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'vi' ? 'Lấy từ Google Drive' : 'Import from Drive'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLessonTitle('Công dân số thông minh & An toàn AI');
                    setSourceFileName('BaiHoc_Mau_CongDanSo.txt');
                    setTextContent(SAMPLE_LESSON_TEXT);
                    setBase64Data(undefined);
                  }}
                  className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                >
                  {lang === 'vi' ? 'Điền nhanh bài mẫu' : 'Use Sample Lesson'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="lesson-title-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {lang === 'vi' ? 'Tên bài học' : 'Lesson Title'}
                </label>
                <input
                  id="lesson-title-input"
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder={
                    lang === 'vi'
                      ? 'VD: An toàn mạng & Bản quyền số'
                      : 'e.g. Digital Safety & Copyright'
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="question-count-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {lang === 'vi' ? 'Số lượng câu hỏi' : 'Question Count'}
                </label>
                <select
                  id="question-count-select"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {[5, 10, 15, 20, 25].map((n) => (
                    <option key={n} value={n}>
                      {n} {lang === 'vi' ? 'câu hỏi' : 'questions'}
                      {n === 15 ? (lang === 'vi' ? ' (Chuẩn)' : ' (Recommended)') : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="lesson-file-upload"
                className="block text-xs font-semibold text-slate-700"
              >
                {lang === 'vi'
                  ? 'Tải file bài học (.txt, .md, .csv, .pdf, ảnh trang sách)'
                  : 'Upload lesson file (.txt, .md, .csv, .pdf, image)'}
              </label>
              <input
                id="lesson-file-upload"
                type="file"
                accept=".txt,.md,.csv,.pdf,image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
              />
              {base64Data && (
                <p className="text-xs text-emerald-700 font-medium">
                  {lang === 'vi'
                    ? `Đã nạp tệp đính kèm: ${sourceFileName}`
                    : `Loaded binary attachment: ${sourceFileName}`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="lesson-content-textarea"
                className="block text-xs font-semibold text-slate-700"
              >
                {lang === 'vi'
                  ? 'Hoặc dán nội dung bài học tại đây'
                  : 'Or paste lesson content here'}
              </label>
              <textarea
                id="lesson-content-textarea"
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Dán văn bản bài giảng, ghi chú bài học để EduBot tạo câu hỏi kèm từ khóa gợi ý tìm kiếm AI...'
                    : 'Paste lesson text for EduBot to generate questions and AI search keyword hints...'
                }
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                {lang === 'vi'
                  ? 'Giao bài và gửi Thông báo đẩy cho các lớp:'
                  : 'Assign & Push Notification to Classes:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const active = targetClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleTargetClass(c.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      <span>{c.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {genStatus && (
              <p
                role="status"
                className={`text-sm font-medium p-3 rounded-xl border ${
                  genStatus.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {genStatus.text}
              </p>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {generating
                  ? lang === 'vi'
                    ? 'EduBot AI đang đọc tài liệu & tạo câu hỏi...'
                    : 'EduBot AI is generating questions...'
                  : copy.generateQuizBtn}
              </span>
            </button>
          </form>

          {/* Existing Lessons Quick Library */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'vi'
                ? `Kho bài học hiện có (${lessons.length})`
                : `Lesson Library (${lessons.length})`}
            </h2>
            <div className="divide-y divide-slate-100">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lesson.questions.length} {lang === 'vi' ? 'câu' : 'Q'} ·{' '}
                        {lesson.assignedClassIds.join(', ') || 'Chưa giao'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Chỉnh sửa ${lesson.title}`}
                        onClick={() => setEditingLesson(lesson)}
                        className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteLessonId === lesson.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                          >
                            {lang === 'vi' ? 'Xóa' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLessonId(null)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            {lang === 'vi' ? 'Hủy' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Xóa ${lesson.title}`}
                          onClick={() => setConfirmDeleteLessonId(lesson.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onSelectLessonForPlay(lesson.id)}
                      className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                    >
                      {lang === 'vi' ? 'Chạy thử trò chơi bài này →' : 'Launch quiz →'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLesson(lesson)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'vi'
                          ? 'Chỉnh sửa bài & câu hỏi'
                          : 'Edit Lesson & Questions'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setJsonLessonId((prev) => (prev === lesson.id ? null : lesson.id))
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>
                        {jsonLessonId === lesson.id
                          ? lang === 'vi'
                            ? 'Ẩn JSON câu hỏi'
                            : 'Hide JSON'
                          : lang === 'vi'
                            ? 'Xem JSON EduBot'
                            : 'View EduBot JSON'}
                      </span>
                    </button>
                  </div>

                  {jsonLessonId === lesson.id && (
                    <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {lang === 'vi'
                            ? 'Định dạng JSON EduBot Digital Citizen'
                            : 'EduBot Digital Citizen JSON'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealJsonAnswer((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                        >
                          {revealJsonAnswer ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Ẩn đáp án' : 'Mask Answers'}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === 'vi' ? 'Hiện đáp án' : 'Reveal Answers'}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono-num text-slate-800 overflow-x-auto max-h-64 leading-relaxed">
                        {JSON.stringify(
                          lesson.questions.map((q) => {
                            const ids =
                              q.competencyIds && q.competencyIds.length > 0
                                ? q.competencyIds
                                : [q.competencyId];
                            return {
                              question_text: q.questionText,
                              type: q.type,
                              ...(q.options ? { options: q.options } : {}),
                              keywords_hint: q.aiSearchKeywordHint,
                              correct_answer: revealJsonAnswer
                                ? q.correctAnswer ?? ''
                                : '[ĐÃ ẨN - CHỈ HỆ THỐNG BIẾT]',
                              digital_citizen_competencies: ids.map((id) => {
                                const c = getCompetencyById(id);
                                return `${c.id}. ${lang === 'vi' ? c.nameVi : c.nameEn}`;
                              }),
                            };
                          }),
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Class Management, Tablet Join Links & Lesson Reuse */}
      {subTab === 'classes' && (
        <div className="space-y-6">
          {/* Student Join Links & Codes Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-sky-600" />
                  <span>
                    {lang === 'vi'
                      ? 'Link & Mã vào lớp cho 10 máy tính bảng học sinh'
                      : 'Student Tablet Join Links & Class Codes'}
                  </span>
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  {lang === 'vi'
                    ? 'Gửi link hoặc đọc Mã lớp cho học sinh mở trên máy tính bảng. Học sinh chỉ thấy giao diện chơi game, không thấy đáp án hay trang giáo viên.'
                    : 'Share a join link or Class Code for student tablets. Students only see the student quiz interface.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="tablet-link-preset"
                  className="text-xs font-semibold text-slate-600"
                >
                  {lang === 'vi' ? 'Gắn sẵn số máy:' : 'Preset tablet:'}
                </label>
                <select
                  id="tablet-link-preset"
                  value={previewTablet}
                  onChange={(e) => setPreviewTablet(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  <option value={0}>
                    {lang === 'vi' ? 'Chung cả lớp (học sinh tự chọn máy)' : 'Class-wide link'}
                  </option>
                  {Array.from({ length: 10 }, (_, idx) => idx + 1).map((num) => (
                    <option key={num} value={num}>
                      {lang === 'vi'
                        ? `Máy ${String(num).padStart(2, '0')}`
                        : `Tablet ${String(num).padStart(2, '0')}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {classActionError && (
              <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {classActionError}
              </p>
            )}

            <div className="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-sky-900">
                {lang === 'vi'
                  ? 'Học sinh KHÔNG cần kết nối Firebase hay đăng nhập Google!'
                  : 'Students NEVER need Firebase or Google login!'}
              </p>
              <p className="leading-relaxed">
                {lang === 'vi'
                  ? `Các link bên dưới đã tự động trỏ tới địa chỉ Share App (${shareOrigin}). Hãy bật quyền chia sẻ công khai trong "Share App" của AI Studio để máy tính bảng học sinh mở được ngay. Thầy/cô cũng có thể mở trực tiếp ${buildTeacherPortalUrl(shareOrigin)} (PIN: 2025) trên Share App hoặc dùng nút Xuất / Nhập file JSON bên dưới mà không cần đăng nhập Google.`
                  : `Links below point automatically to your public Share App URL (${shareOrigin}). Make sure Share App visibility is enabled in AI Studio, or manage lessons directly at ${buildTeacherPortalUrl(shareOrigin)} (PIN: 2025) / use JSON Export-Import without Google sign-in.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const joinUrl = buildStudentJoinUrl(
                  shareOrigin,
                  cls.id,
                  previewTablet > 0 ? previewTablet : undefined,
                  shareCode,
                );
                const copyId = `class-link-${cls.id}`;
                const isEditingThis = editingClass?.originalId === cls.id;

                if (isEditingThis && editingClass) {
                  return (
                    <form
                      key={cls.id}
                      onSubmit={handleSaveEditedClass}
                      className="p-4 rounded-xl border-2 border-sky-400 bg-sky-50/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-800">
                          {lang === 'vi' ? `Sửa lớp ${cls.id}` : `Edit ${cls.id}`}
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        value={editingClass.id}
                        onChange={(e) =>
                          setEditingClass({
                            ...editingClass,
                            id: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="Mã lớp (VD: LOP-5A)"
                        className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        required
                        value={editingClass.name}
                        onChange={(e) =>
                          setEditingClass({ ...editingClass, name: e.target.value })
                        }
                        placeholder="Tên lớp học"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editingClass.grade}
                          onChange={(e) =>
                            setEditingClass({ ...editingClass, grade: e.target.value })
                          }
                          placeholder="Khối"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                        <input
                          type="text"
                          value={editingClass.teacherName}
                          onChange={(e) =>
                            setEditingClass({
                              ...editingClass,
                              teacherName: e.target.value,
                            })
                          }
                          placeholder="Giáo viên"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={classSaving}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                        >
                          {lang === 'vi' ? 'Lưu' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingClass(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {lang === 'vi' ? 'Hủy' : 'Cancel'}
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={cls.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-base font-bold text-sky-700">
                        {cls.id}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Sửa lớp ${cls.id}`}
                          onClick={() =>
                            setEditingClass({
                              originalId: cls.id,
                              id: cls.id,
                              name: cls.name,
                              grade: cls.grade,
                              teacherName: cls.teacherName,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{lang === 'vi' ? 'Sửa' : 'Edit'}</span>
                        </button>
                        {confirmDeleteClassId === cls.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(cls.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                            >
                              {lang === 'vi' ? 'Xác nhận' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteClassId(null)}
                              className="px-1.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-200 rounded-md cursor-pointer"
                            >
                              {lang === 'vi' ? 'Hủy' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Xóa lớp ${cls.id}`}
                            onClick={() => setConfirmDeleteClassId(cls.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {cls.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {cls.grade} · {cls.teacherName}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono-num text-slate-700 break-all">
                      {joinUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(copyId, joinUrl)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
                    >
                      {copiedKey === copyId ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{lang === 'vi' ? 'Đã sao chép link!' : 'Copied link!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'vi' ? `Sao chép link ${cls.id}` : `Copy ${cls.id} link`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {lang === 'vi'
                      ? 'Link riêng Giáo viên (Share App):'
                      : 'Dedicated Teacher URL:'}
                  </span>
                  <code className="px-2 py-1 rounded bg-slate-100 font-mono-num text-slate-800 break-all">
                    {buildTeacherPortalUrl(shareOrigin)}
                  </code>
                  <span className="font-semibold text-slate-800">
                    ({lang === 'vi' ? 'PIN mặc định: 2025' : 'Default PIN: 2025'})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText('teacher-portal-url', buildTeacherPortalUrl(shareOrigin))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    {copiedKey === 'teacher-portal-url' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{lang === 'vi' ? 'Đã sao chép!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'vi' ? 'Sao chép link Giáo viên' : 'Copy Teacher URL'}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportWorkspace}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'vi'
                        ? 'Xuất Lớp & Bài (.json)'
                        : 'Export Workspace (.json)'}
                    </span>
                  </button>

                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportWorkspaceFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'vi' ? 'Nhập file (.json)' : 'Import (.json)'}
                    </span>
                  </button>
                </div>
              </div>

              {transferStatus && (
                <p
                  role="status"
                  className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                    transferStatus.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {transferStatus.text}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleCreateClass}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'vi' ? 'Thêm lớp học mới' : 'Create Classroom'}
            </h2>

            <div className="space-y-1.5">
              <label htmlFor="new-class-id" className="block text-xs font-semibold text-slate-700">
                {lang === 'vi' ? 'Mã lớp (VD: LOP-6B)' : 'Class Code'}
              </label>
              <input
                id="new-class-id"
                type="text"
                required
                value={newClassCode}
                onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                placeholder="LOP-6B"
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-class-name" className="block text-xs font-semibold text-slate-700">
                {lang === 'vi' ? 'Tên lớp học' : 'Class Name'}
              </label>
              <input
                id="new-class-name"
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Lớp 6B - Công dân số"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="new-class-grade" className="block text-xs font-semibold text-slate-700">
                  {lang === 'vi' ? 'Khối' : 'Grade'}
                </label>
                <input
                  id="new-class-grade"
                  type="text"
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-class-teacher" className="block text-xs font-semibold text-slate-700">
                  {lang === 'vi' ? 'Giáo viên' : 'Teacher'}
                </label>
                <input
                  id="new-class-teacher"
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Cô Lan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={classSaving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Lưu lớp học' : 'Save Classroom'}</span>
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {lang === 'vi'
                  ? 'Tái sử dụng 1 bài học cho nhiều lớp (Tự động gửi Thông báo đẩy)'
                  : 'Reuse Lessons Across Multiple Classes (Auto Push Alerts)'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {lang === 'vi'
                  ? 'Bật/tắt mã lớp để giao lại cùng một bộ câu hỏi cho các tiết học khác nhau trên 10 máy tính bảng.'
                  : 'Toggle class assignments to reuse any lesson across multiple class periods.'}
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {lesson.title}
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingLesson(lesson)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{lang === 'vi' ? 'Chỉnh sửa bài & câu hỏi' : 'Edit'}</span>
                      </button>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {lesson.questions.length} {lang === 'vi' ? 'câu hỏi' : 'questions'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {classes.map((cls) => {
                      const assigned = lesson.assignedClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleToggleLessonClass(lesson, cls.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                            assigned
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {assigned && <Check className="w-3.5 h-3.5" />}
                          <span>{cls.id}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TAB 3: 24 Digital Citizenship Competencies Matrix (TT 02/2025) */}
      {subTab === 'matrix' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {copy.competencyMatrixTitle}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {lang === 'vi'
                  ? 'Ánh xạ đầy đủ 6 miền và 24 năng lực thành phần theo Khung Năng Lực Số (TT 02/2025).'
                  : 'Complete mapping of 6 domains and 24 competencies from the Digital Competence Framework.'}
              </p>
            </div>
            <a
              href="https://mapify.so/vi/share-link/lHJ3Xmliyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-700 hover:underline break-all"
            >
              https://mapify.so/vi/share-link/lHJ3Xmliyz
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {COMPETENCY_DOMAINS.map((domain) => {
              const items = COMPETENCIES_24.filter((c) => c.domainId === domain.id);
              return (
                <div
                  key={domain.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: domain.accentHex }}
                  />
                  <div className="p-5 space-y-3 flex-1">
                    <h3 className={`text-base font-bold ${domain.textClass}`}>
                      {domain.number}. {lang === 'vi' ? domain.nameVi : domain.nameEn}
                    </h3>

                    <div className="space-y-1.5">
                      {items.map((comp) => {
                        const stat = competencyMatrix.find(
                          (m) => m.competencyId === comp.id,
                        );
                        return (
                          <div
                            key={comp.id}
                            className="px-3 py-2 rounded-lg border border-slate-200/80 bg-slate-50/50 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-slate-900">
                              <strong className="font-mono-num">{comp.id}.</strong>{' '}
                              {lang === 'vi' ? comp.nameVi : comp.nameEn}
                            </span>
                            <span className="font-mono-num text-slate-500 shrink-0 tabular-nums">
                              {stat?.questionCount ?? 0}Q
                              {stat?.accuracyPercent !== null &&
                              stat?.accuracyPercent !== undefined
                                ? ` · ${stat.accuracyPercent}%`
                                : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Student Activity History */}
      {subTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {copy.activityHistoryTitle}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {activityLogs.length} {lang === 'vi' ? 'bản ghi' : 'events'}
            </span>
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {lang === 'vi'
                ? 'Chưa có hoạt động nào được ghi nhận.'
                : 'No activity recorded yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <th className="py-3 px-6">{lang === 'vi' ? 'Thời gian' : 'Time'}</th>
                    <th className="py-3 px-4">{lang === 'vi' ? 'Lớp' : 'Class'}</th>
                    <th className="py-3 px-4">{lang === 'vi' ? 'Nhóm / Máy' : 'Group'}</th>
                    <th className="py-3 px-4">{lang === 'vi' ? 'Hoạt động' : 'Action'}</th>
                    <th className="py-3 px-4">{lang === 'vi' ? 'Chi tiết' : 'Detail'}</th>
                    <th className="py-3 px-6 text-right">{lang === 'vi' ? 'Điểm' : 'Points'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-6 font-mono-num text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs font-semibold text-sky-700 whitespace-nowrap">
                        {log.classId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {log.groupId}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{log.detail}</td>
                      <td className="py-3 px-6 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {log.pointsDelta !== undefined ? `+${log.pointsDelta}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Full Lesson & 15+ Questions Editor Modal */}
      {editingLesson && (
        <LessonEditorModal
          lesson={editingLesson}
          classes={classes}
          lang={lang}
          onClose={() => setEditingLesson(null)}
          onSave={async (updated) => {
            if (cloudUser) {
              await saveLessonToFirestore(updated, cloudUser.uid);
              await publishLatestPublicSnapshot(cloudUser.uid);
            }
            await onRefreshData();
          }}
        />
      )}
    </section>
  );
}
