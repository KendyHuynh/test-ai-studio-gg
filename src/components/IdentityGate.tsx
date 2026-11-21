import { useEffect, useState } from 'react';
import { ArrowRight, Check, Link2, RotateCcw, Tablet, Users } from 'lucide-react';
import { CopyDict } from '../shared/i18n';
import { formatGroupId } from '../shared/scoring';
import { ClassRoom, Language, SessionIdentity, UiMode } from '../shared/types';

interface IdentityGateProps {
  classes: ClassRoom[];
  activeSession: SessionIdentity | null;
  initialClassId?: string | null;
  initialTabletNumber?: number | null;
  onConfirmSession: (session: SessionIdentity) => void;
  onClearSession: () => void;
  copy: CopyDict;
  lang: Language;
  uiMode: UiMode;
}

const DEFAULT_TEAM_NAMES = [
  'Sao Xanh',
  'Tia Chớp',
  'Hải Âu',
  'Robot Nhí',
  'Họa Mi',
  'Mặt Trời',
  'Đại Dương',
  'Cánh Diều',
  'Bình Minh',
  'Khám Phá',
];

export function IdentityGate({
  classes,
  activeSession,
  initialClassId,
  initialTabletNumber,
  onConfirmSession,
  onClearSession,
  copy,
  lang,
  uiMode,
}: IdentityGateProps) {
  const defaultTablet = activeSession?.tabletNumber || initialTabletNumber || 3;
  const [selectedClassId, setSelectedClassId] = useState(
    activeSession?.classId || initialClassId || classes[0]?.id || 'LOP-5A',
  );
  const [tabletNumber, setTabletNumber] = useState<number>(defaultTablet);
  const [groupName, setGroupName] = useState<string>(
    activeSession?.groupName ||
      DEFAULT_TEAM_NAMES[defaultTablet - 1] ||
      DEFAULT_TEAM_NAMES[2],
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialClassId && !activeSession) {
      setSelectedClassId(initialClassId);
    }
  }, [initialClassId, activeSession]);

  useEffect(() => {
    if (
      initialTabletNumber &&
      initialTabletNumber >= 1 &&
      initialTabletNumber <= 10 &&
      !activeSession
    ) {
      setTabletNumber(initialTabletNumber);
      setGroupName((prev) =>
        !prev || DEFAULT_TEAM_NAMES.includes(prev)
          ? DEFAULT_TEAM_NAMES[initialTabletNumber - 1] ?? `Nhóm ${initialTabletNumber}`
          : prev,
      );
    }
  }, [initialTabletNumber, activeSession]);

  const handleTabletPick = (num: number) => {
    setTabletNumber(num);
    if (!groupName || DEFAULT_TEAM_NAMES.includes(groupName)) {
      setGroupName(DEFAULT_TEAM_NAMES[num - 1] ?? `Nhóm ${num}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClass = selectedClassId.trim().toUpperCase();
    const cleanGroup = groupName.trim();
    if (!cleanClass) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng chọn hoặc nhập Mã lớp học trước khi bắt đầu.'
          : 'Please select or enter a Class Code first.',
      );
      return;
    }
    if (!cleanGroup) {
      setErrorMsg(
        lang === 'vi'
          ? 'Vui lòng nhập Tên nhóm của em trên máy tính bảng này.'
          : 'Please enter your Team / Group Name.',
      );
      return;
    }
    setErrorMsg('');
    onConfirmSession({
      classId: cleanClass,
      tabletNumber,
      groupName: cleanGroup,
      groupId: formatGroupId(tabletNumber, cleanGroup),
    });
  };

  return (
    <section className="max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-sky-700">
            {lang === 'vi'
              ? 'Bước 1 · Định danh máy tính bảng dùng chung'
              : 'Step 1 · Shared Tablet Session Check-In'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
            {copy.step1Title}
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            {copy.step1Subtitle}
          </p>
        </div>

        {(initialClassId || initialTabletNumber) && !activeSession && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs sm:text-sm text-sky-900">
            <Link2 className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <span>
              {lang === 'vi'
                ? `Đã nhận thông tin từ link giáo viên: Lớp ${initialClassId ?? selectedClassId}${
                    initialTabletNumber
                      ? ` · Máy ${String(initialTabletNumber).padStart(2, '0')}`
                      : ''
                  }. Kiểm tra lại tên nhóm rồi bấm Bắt đầu!`
                : `Joined via teacher link: Class ${initialClassId ?? selectedClassId}${
                    initialTabletNumber
                      ? ` · Tablet ${String(initialTabletNumber).padStart(2, '0')}`
                      : ''
                  }. Verify your team name and start!`}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Class selection */}
          <div className="space-y-3">
            <label
              htmlFor="class-code-select"
              className="flex items-center gap-2 text-sm font-semibold text-slate-900"
            >
              <Users className="w-4 h-4 text-sky-600" />
              <span>{copy.classCodeLabel}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {classes.map((cls) => {
                const selected = selectedClassId === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer min-h-[56px] ${
                      selected
                        ? 'border-sky-600 bg-sky-50/70 text-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-bold text-sky-700">
                        {cls.id}
                      </span>
                      {selected && <Check className="w-4 h-4 text-sky-600" />}
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                      {cls.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {cls.grade} · {cls.teacherName}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <input
                id="class-code-select"
                type="text"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value.toUpperCase())}
                placeholder="LOP-5A"
                className="w-full sm:w-64 px-3.5 py-2.5 text-sm font-mono-num font-semibold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Nhập Mã lớp giáo viên cung cấp hoặc mở link tham gia lớp.'
                  : 'Enter the Class Code shared by your teacher or open their join link.'}
              </span>
            </div>
          </div>

          {/* 10 Shared Tablets Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Tablet className="w-4 h-4 text-sky-600" />
                <span>{copy.tabletSelectLabel}</span>
              </span>
              <span className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Luân chuyển 10 máy qua từng tiết học'
                  : '10 shared classroom tablets'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                const selected = tabletNumber === num;
                const pad = String(num).padStart(2, '0');
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleTabletPick(num)}
                    className={`flex items-center justify-center gap-2 rounded-xl border transition-colors cursor-pointer font-semibold tabular-nums ${
                      uiMode === 'kid' ? 'py-3 px-3 text-sm sm:text-base' : 'py-2.5 px-3 text-sm'
                    } ${
                      selected
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Tablet className="w-4 h-4 shrink-0" />
                    <span>
                      {lang === 'vi' ? `Máy ${pad}` : `Tab ${pad}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <label
              htmlFor="group-name-input"
              className="block text-sm font-semibold text-slate-900"
            >
              {copy.groupNameLabel}
            </label>
            <input
              id="group-name-input"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={copy.groupNamePlaceholder}
              className={`w-full px-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                uiMode === 'kid' ? 'py-3.5 text-base font-medium' : 'py-2.5 text-sm'
              }`}
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {errorMsg}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
            {activeSession ? (
              <button
                type="button"
                onClick={onClearSession}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{copy.switchShiftBtn}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Thông tin định danh được lưu an toàn trên máy này.'
                  : 'Identity is saved locally for this tablet shift.'}
              </span>
            )}

            <button
              type="submit"
              className={`inline-flex items-center gap-2 px-6 font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors cursor-pointer ${
                uiMode === 'kid' ? 'py-3.5 text-base' : 'py-2.5 text-sm'
              }`}
            >
              <span>{copy.startMissionBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
