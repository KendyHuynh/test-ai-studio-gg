import { CopyDict } from '../shared/i18n';
import { Language, SessionIdentity } from '../shared/types';
import { AppPortal } from '../utils/routing';

export type ActiveTab = 'identity' | 'play' | 'honor' | 'teacher';

interface TopNavProps {
  portal: AppPortal;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  session: SessionIdentity | null;
  copy: CopyDict;
  lang: Language;
  onQuickSwitchShift: () => void;
  onSwitchToStudentPortal: () => void;
}

export function TopNav({
  portal,
  activeTab,
  onSelectTab,
  session,
  copy,
  lang,
  onQuickSwitchShift,
  onSwitchToStudentPortal,
}: TopNavProps) {
  const studentNavItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'identity', label: copy.navIdentity },
    { id: 'play', label: copy.navPlay },
    { id: 'honor', label: copy.navHonor },
  ];

  const teacherNavItems: Array<{ id: ActiveTab; label: string }> = [
    {
      id: 'teacher',
      label: lang === 'vi' ? 'Quản trị Giáo viên' : 'Teacher Workspace',
    },
    { id: 'honor', label: copy.navHonor },
  ];

  const navItems = portal === 'teacher' ? teacherNavItems : studentNavItems;

  const brandTitle =
    portal === 'teacher'
      ? lang === 'vi'
        ? 'EduBot Giáo Viên'
        : 'EduBot Teacher'
      : copy.brandName;

  const primaryActionLabel =
    portal === 'teacher'
      ? lang === 'vi'
        ? 'Về cổng Học sinh'
        : 'Student Portal'
      : session
        ? `${session.classId} · Máy ${String(session.tabletNumber).padStart(2, '0')}`
        : copy.navIdentity;

  const handlePrimaryAction =
    portal === 'teacher' ? onSwitchToStudentPortal : onQuickSwitchShift;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab(portal === 'teacher' ? 'teacher' : 'identity')}
          className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-sky-700 transition-colors cursor-pointer"
        >
          {brandTitle}
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-sky-600 text-sky-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Điều hướng di động"
        className="flex md:hidden items-center justify-around border-t border-slate-100 px-2 py-1 bg-white"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'text-sky-700 font-semibold underline underline-offset-4'
                  : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
