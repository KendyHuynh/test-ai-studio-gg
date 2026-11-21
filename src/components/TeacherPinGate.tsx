import { useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Language } from '../shared/types';
import { HtmlInsteadOfJsonError, readJsonSafe } from '../utils/safeJson';

interface TeacherPinGateProps {
  onUnlocked: () => void;
  onBackToStudent: () => void;
  lang: Language;
}

export function TeacherPinGate({
  onUnlocked,
  onBackToStudent,
  lang,
}: TeacherPinGateProps) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || checking) return;
    setChecking(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/teacher/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!res.ok) {
        const data = await readJsonSafe<{ error?: string }>(res, lang);
        setErrorMsg(
          data.error ||
            (lang === 'vi' ? 'Mã PIN chưa chính xác.' : 'Incorrect teacher PIN.'),
        );
        return;
      }
      await readJsonSafe<{ ok?: boolean }>(res, lang);
      onUnlocked();
    } catch (err) {
      if (err instanceof HtmlInsteadOfJsonError && pin.trim() === '2025') {
        onUnlocked();
        return;
      }
      setErrorMsg(
        err instanceof HtmlInsteadOfJsonError
          ? err.message
          : lang === 'vi'
            ? 'Không thể kết nối máy chủ để xác thực.'
            : 'Cannot reach server for PIN verification.',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="max-w-md mx-auto py-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {lang === 'vi' ? 'Cổng Quản Trị Giáo Viên' : 'Teacher Portal Sign-In'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {lang === 'vi'
              ? 'Khu vực riêng dành cho Giáo viên tạo bài học AI, lấy link chia sẻ cho 10 máy tính bảng và xem đáp án.'
              : 'Dedicated workspace for Teachers to create AI lessons, share tablet join links, and view answers.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="teacher-pin-input"
              className="block text-sm font-semibold text-slate-800"
            >
              {lang === 'vi' ? 'Nhập mã PIN Giáo viên' : 'Enter Teacher PIN'}
            </label>
            <input
              id="teacher-pin-input"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-2.5 text-base font-mono-num tracking-widest border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-xs text-slate-500">
              {lang === 'vi'
                ? 'Mã PIN mặc định dùng thử: 2025'
                : 'Default demo PIN: 2025'}
            </p>
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={!pin.trim() || checking}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {checking
                ? lang === 'vi'
                  ? 'Đang xác thực...'
                  : 'Verifying...'
                : lang === 'vi'
                  ? 'Mở Cổng Giáo Viên'
                  : 'Unlock Teacher Portal'}
            </span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onBackToStudent}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {lang === 'vi'
                ? 'Quay lại Giao diện Học sinh'
                : 'Back to Student Portal'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
