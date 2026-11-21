import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CloudUpload,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Language, Lesson } from '../shared/types';
import { formatFirebaseAuthError } from '../utils/authErrors';
import { DriveFileItem } from '../utils/driveHelpers';
import {
  deleteDriveFile,
  getAccessToken,
  googleSignIn,
  initAuth,
  listDriveFiles,
  logoutGoogle,
  readDriveFileContent,
  uploadJsonToDrive,
} from '../utils/googleDrive';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleDrivePanelProps {
  lessons: Lesson[];
  lang: Language;
  onImportLessonFile: (payload: {
    title: string;
    fileName: string;
    textContent?: string;
    base64Data?: string;
    mimeType?: string;
  }) => void;
}

export function GoogleDrivePanel({
  lessons,
  lang,
  onImportLessonFile,
}: GoogleDrivePanelProps) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    suggestNewTab?: boolean;
  } | null>(null);

  // Explicit confirmation modals for Drive mutations / deletions
  const [pendingDeleteFile, setPendingDeleteFile] = useState<DriveFileItem | null>(
    null,
  );
  const [pendingUploadLesson, setPendingUploadLesson] = useState<Lesson | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadFiles = async (tokenOverride?: string, queryOverride?: string) => {
    const token = tokenOverride ?? (await getAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setLoadingFiles(true);
    setStatusMsg(null);
    try {
      const result = await listDriveFiles(token, queryOverride ?? searchTerm);
      setFiles(result);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tải danh sách tệp.',
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        loadFiles(token, '');
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setFiles([]);
      },
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await loadFiles(result.accessToken, '');
      }
    } catch (err) {
      const formatted = formatFirebaseAuthError(err, lang);
      setStatusMsg({
        type: 'err',
        text: formatted.message,
        suggestNewTab: formatted.suggestNewTab,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setNeedsAuth(true);
    setFiles([]);
    setStatusMsg(null);
  };

  const handleImportFile = async (file: DriveFileItem) => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyFileId(file.id);
    setStatusMsg(null);
    try {
      const content = await readDriveFileContent(token, file);
      onImportLessonFile(content);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đọc tệp từ Google Drive.',
      });
    } finally {
      setBusyFileId(null);
    }
  };

  const handleConfirmUploadLesson = async () => {
    if (!pendingUploadLesson) return;
    const token = await getAccessToken();
    if (!token) {
      setPendingUploadLesson(null);
      setNeedsAuth(true);
      return;
    }
    setMutating(true);
    try {
      const safeName = pendingUploadLesson.title
        .replace(/[^\p{L}\p{N}_-]+/gu, '_')
        .slice(0, 48);
      const fileName = `EduBot_${safeName || pendingUploadLesson.id}.json`;
      await uploadJsonToDrive(token, fileName, pendingUploadLesson);
      setStatusMsg({
        type: 'ok',
        text:
          lang === 'vi'
            ? `Đã lưu "${fileName}" lên Google Drive thành công!`
            : `Saved "${fileName}" to Google Drive!`,
      });
      setPendingUploadLesson(null);
      await loadFiles(token);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tải tệp lên Google Drive.',
      });
      setPendingUploadLesson(null);
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!pendingDeleteFile) return;
    const token = await getAccessToken();
    if (!token) {
      setPendingDeleteFile(null);
      setNeedsAuth(true);
      return;
    }
    setMutating(true);
    try {
      await deleteDriveFile(token, pendingDeleteFile.id);
      setStatusMsg({
        type: 'ok',
        text:
          lang === 'vi'
            ? `Đã xóa tệp "${pendingDeleteFile.name}" khỏi Google Drive.`
            : `Deleted "${pendingDeleteFile.name}" from Google Drive.`,
      });
      setPendingDeleteFile(null);
      await loadFiles(token);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể xóa tệp trên Google Drive.',
      });
      setPendingDeleteFile(null);
    } finally {
      setMutating(false);
    }
  };

  if (needsAuth) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 mx-auto">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            {lang === 'vi'
              ? 'Kết nối Google Drive của Giáo viên'
              : 'Connect Teacher Google Drive'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {lang === 'vi'
              ? 'Đăng nhập bằng tài khoản Google để duyệt Google Docs, PDF, bài giảng trên Drive, nạp trực tiếp vào trình tạo câu hỏi AI và sao lưu bộ đề thi.'
              : 'Sign in with Google to import Google Docs, PDFs, or text lessons from Drive into AI quiz generation and back up lesson files.'}
          </p>
        </div>

        <div className="flex justify-center">
          <GoogleSignInButton
            onClick={handleLogin}
            loading={isLoggingIn}
            label="Sign in with Google"
          />
        </div>

        {statusMsg && (
          <div
            role="alert"
            className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-left"
          >
            <p>{statusMsg.text}</p>
            {statusMsg.suggestNewTab && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-semibold text-sky-700 hover:underline"
              >
                {lang === 'vi' ? 'Mở ứng dụng ở tab mới →' : 'Open in new tab →'}
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Account Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-700">
            {lang === 'vi' ? 'Đã kết nối Google Drive' : 'Google Drive Connected'}
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {user?.displayName || user?.email || 'Google Account'}
            {user?.email && user?.displayName ? ` · ${user.email}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Đăng xuất Google' : 'Sign out'}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm font-medium ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Browse & Import from Google Drive */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'vi'
                ? 'Tài liệu bài học trên Google Drive'
                : 'Files on Google Drive'}
            </h2>
            <button
              type="button"
              onClick={() => loadFiles()}
              disabled={loadingFiles}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`}
              />
              <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadFiles();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Tìm tên tệp trên Drive (VD: Công dân số)...'
                    : 'Search Drive file name...'
                }
                className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer whitespace-nowrap"
            >
              {lang === 'vi' ? 'Tìm kiếm' : 'Search'}
            </button>
          </form>

          {loadingFiles ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {lang === 'vi'
                ? 'Đang tải danh sách tệp từ Google Drive...'
                : 'Loading files from Google Drive...'}
            </p>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {lang === 'vi'
                ? 'Không tìm thấy tệp phù hợp trên Google Drive.'
                : 'No matching files found on Google Drive.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {file.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 pl-6 truncate">
                      {file.mimeType.replace('application/vnd.google-apps.', 'Google ')}
                      {file.modifiedTime
                        ? ` · ${new Date(file.modifiedTime).toLocaleDateString('vi-VN')}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={lang === 'vi' ? 'Mở trên Drive' : 'Open in Drive'}
                        className="p-2 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busyFileId === file.id}
                      onClick={() => handleImportFile(file)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {busyFileId === file.id
                          ? lang === 'vi'
                            ? 'Đang nạp...'
                            : 'Importing...'
                          : lang === 'vi'
                            ? 'Nạp tạo câu hỏi AI'
                            : 'Import to AI'}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa ${file.name} trên Drive`}
                      onClick={() => setPendingDeleteFile(file)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Backup / Export EduBot Lessons to Google Drive */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'vi'
                ? 'Sao lưu bộ câu hỏi lên Google Drive'
                : 'Back Up Lessons to Google Drive'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'vi'
                ? 'Lưu bản sao JSON các bài học và câu hỏi Công dân số vào Google Drive của bạn.'
                : 'Save JSON backups of your lessons directly to your Google Drive.'}
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {lesson.title}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {lesson.questions.length} {lang === 'vi' ? 'câu hỏi' : 'questions'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingUploadLesson(lesson)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Lưu lên Drive' : 'Save to Drive'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explicit Confirmation Modal: Upload to Drive */}
      {pendingUploadLesson && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {lang === 'vi'
                ? 'Xác nhận lưu bài học lên Google Drive'
                : 'Confirm Save to Google Drive'}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {lang === 'vi'
                ? `Hệ thống sẽ tạo một tệp JSON mới trên Google Drive của bạn cho bài "${pendingUploadLesson.title}" (${pendingUploadLesson.questions.length} câu hỏi).`
                : `This will create a new JSON file in your Google Drive for "${pendingUploadLesson.title}".`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={mutating}
                onClick={() => setPendingUploadLesson(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={handleConfirmUploadLesson}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                {mutating
                  ? lang === 'vi'
                    ? 'Đang lưu...'
                    : 'Saving...'
                  : lang === 'vi'
                    ? 'Xác nhận lưu'
                    : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal: Delete from Drive */}
      {pendingDeleteFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-rose-700">
              {lang === 'vi'
                ? 'Xác nhận xóa tệp khỏi Google Drive?'
                : 'Delete file from Google Drive?'}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {lang === 'vi'
                ? `Bạn có chắc chắn muốn xóa tệp "${pendingDeleteFile.name}" trên Google Drive không? Thao tác này sẽ xóa tệp khỏi Drive của bạn.`
                : `Are you sure you want to delete "${pendingDeleteFile.name}" from Google Drive? This action cannot be undone.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={mutating}
                onClick={() => setPendingDeleteFile(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={handleConfirmDeleteFile}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                {mutating
                  ? lang === 'vi'
                    ? 'Đang xóa...'
                    : 'Deleting...'
                  : lang === 'vi'
                    ? 'Xác nhận xóa'
                    : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
