import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Globe,
  Lock,
  RefreshCw,
  Smile,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { HonorBoard } from './components/HonorBoard';
import { IdentityGate } from './components/IdentityGate';
import { NotificationDrawer } from './components/NotificationDrawer';
import { StudentArena } from './components/StudentArena';
import { TeacherPinGate } from './components/TeacherPinGate';
import { TeacherStudio } from './components/TeacherStudio';
import { ActiveTab, TopNav } from './components/TopNav';
import { getCopy } from './shared/i18n';
import { CompetencyCoverageStat, DomainHonorAward } from './shared/scoring';
import {
  ActivityLog,
  AnswerSubmission,
  ClassRoom,
  Language,
  LeaderboardEntry,
  Lesson,
  OfflineQueueItem,
  PushNotification,
  SessionIdentity,
  UiMode,
} from './shared/types';
import {
  cacheLessonsOffline,
  enqueueOfflineAnswer,
  loadCachedLessons,
  loadOfflineQueue,
  loadSavedSession,
  saveSession,
  syncOfflineQueueToServer,
} from './utils/offlineSync';
import { AppPortal, parseEntryParams } from './utils/routing';
import { readJsonSafe } from './utils/safeJson';

interface BootstrapResponse {
  classes: ClassRoom[];
  lessons: Lesson[];
  leaderboard: LeaderboardEntry[];
  domainChampions?: DomainHonorAward[];
  competencyMatrix: CompetencyCoverageStat[];
  notifications: PushNotification[];
  activityLogs: ActivityLog[];
  submissions?: AnswerSubmission[];
  sharedAppUrl?: string;
}

const TEACHER_UNLOCK_KEY = 'edubot_teacher_unlocked_v1';
const WORKSPACE_CODE_KEY = 'edubot_ws_code_v1';

export default function App() {
  const [lang, setLang] = useState<Language>('vi');
  const [uiMode, setUiMode] = useState<UiMode>('kid');

  const [entryParams, setEntryParams] = useState(() =>
    parseEntryParams(window.location.pathname, window.location.search),
  );
  const [portal, setPortal] = useState<AppPortal>(() => entryParams.portal);
  const [teacherUnlocked, setTeacherUnlocked] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(TEACHER_UNLOCK_KEY) === '1',
  );

  const [session, setSession] = useState<SessionIdentity | null>(() => {
    if (entryParams.autostart) {
      const tab = entryParams.tabletNumber ?? 3;
      const cls = entryParams.classId ?? 'LOP-5A';
      return {
        classId: cls,
        tabletNumber: tab,
        groupName: 'Hải Âu',
        groupId: `Máy-${String(tab).padStart(2, '0')} · Hải Âu`,
      };
    }
    if (entryParams.classId || entryParams.tabletNumber) {
      return null;
    }
    return loadSavedSession();
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (entryParams.portal === 'teacher') return 'teacher';
    if (entryParams.autostart) return 'play';
    return 'identity';
  });

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>(() => loadCachedLessons());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [domainChampions, setDomainChampions] = useState<DomainHonorAward[]>([]);
  const [competencyMatrix, setCompetencyMatrix] = useState<CompetencyCoverageStat[]>(
    [],
  );
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [submissions, setSubmissions] = useState<AnswerSubmission[]>([]);
  const [sharedAppUrl, setSharedAppUrl] = useState<string>('');
  const [workspaceCode, setWorkspaceCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    if (entryParams.workspaceCode) {
      window.localStorage.setItem(WORKSPACE_CODE_KEY, entryParams.workspaceCode);
      return entryParams.workspaceCode;
    }
    return window.localStorage.getItem(WORKSPACE_CODE_KEY);
  });
  const [honorClassId, setHonorClassId] = useState<string>('LOP-5A');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() =>
    loadOfflineQueue(),
  );
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  );
  const [seenNotifIds, setSeenNotifIds] = useState<Set<string>>(new Set());

  const isOfflineEffective = !browserOnline || simulateOffline;
  const copy = getCopy(lang, uiMode);

  const activeClassId =
    activeTab === 'honor'
      ? honorClassId
      : session?.classId || entryParams.classId || classes[0]?.id || 'LOP-5A';

  const fetchBootstrap = useCallback(async () => {
    if (isOfflineEffective) return;
    try {
      const roleParam =
        portal === 'teacher' && teacherUnlocked ? 'teacher' : 'student';
      const wsQuery = workspaceCode
        ? `&ws=${encodeURIComponent(workspaceCode)}`
        : '';
      const url = `/api/bootstrap?classId=${encodeURIComponent(
        activeClassId,
      )}&lang=${lang}&role=${roleParam}${wsQuery}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await readJsonSafe<BootstrapResponse>(res, lang);

      setClasses(data.classes);
      setLessons(data.lessons);
      cacheLessonsOffline(data.lessons);
      setLeaderboard(data.leaderboard);
      setDomainChampions(data.domainChampions ?? []);
      setCompetencyMatrix(data.competencyMatrix);
      setNotifications(data.notifications);
      setActivityLogs(data.activityLogs);
      if (data.sharedAppUrl) {
        setSharedAppUrl(data.sharedAppUrl);
      }
      if (data.submissions) {
        setSubmissions(data.submissions);
      }

      if (
        session &&
        browserPermission === 'granted' &&
        typeof window !== 'undefined' &&
        'Notification' in window
      ) {
        for (const n of data.notifications) {
          if (
            n.classId === session.classId &&
            !n.readByGroupIds.includes(session.groupId) &&
            !seenNotifIds.has(n.id)
          ) {
            new Notification(n.title, { body: n.message });
            setSeenNotifIds((prev) => new Set(prev).add(n.id));
          }
        }
      }
    } catch {
      // Keep cached lessons intact when network flickers
    }
  }, [
    activeClassId,
    browserPermission,
    isOfflineEffective,
    lang,
    portal,
    seenNotifIds,
    session,
    teacherUnlocked,
    workspaceCode,
  ]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseEntryParams(window.location.pathname, window.location.search);
      setEntryParams(parsed);
      if (parsed.workspaceCode) {
        window.localStorage.setItem(WORKSPACE_CODE_KEY, parsed.workspaceCode);
        setWorkspaceCode(parsed.workspaceCode);
      }
      setPortal(parsed.portal);
      setActiveTab(
        parsed.portal === 'teacher' ? 'teacher' : parsed.autostart ? 'play' : 'identity',
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (isOfflineEffective || offlineQueue.length === 0 || syncing) return;
    setSyncing(true);
    try {
      const result = await syncOfflineQueueToServer(lang);
      setOfflineQueue(result.remaining);
      if (result.syncedCount > 0) {
        setSyncNotice(
          lang === 'vi'
            ? `Đã đồng bộ thành công ${result.syncedCount} câu trả lời ngoại tuyến!`
            : `Synced ${result.syncedCount} offline answers!`,
        );
        window.setTimeout(() => setSyncNotice(null), 4000);
        await fetchBootstrap();
      }
    } catch {
      // Leave in queue if network still flaky
    } finally {
      setSyncing(false);
    }
  }, [fetchBootstrap, isOfflineEffective, lang, offlineQueue.length, syncing]);

  // Auto-sync when connectivity returns and queue has items
  useEffect(() => {
    if (!isOfflineEffective && offlineQueue.length > 0) {
      handleSyncNow();
    }
  }, [handleSyncNow, isOfflineEffective, offlineQueue.length]);

  // Poll every 20s for new teacher assignments / notifications
  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchBootstrap();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [fetchBootstrap]);

  const handleConfirmSession = (next: SessionIdentity) => {
    setSession(next);
    saveSession(next);
    setHonorClassId(next.classId);
    setSelectedLessonId(null);
    setActiveTab('play');
  };

  const handleClearSession = () => {
    setSession(null);
    saveSession(null);
    setSelectedLessonId(null);
    setActiveTab('identity');
  };

  const handleQueueOffline = (item: OfflineQueueItem) => {
    const next = enqueueOfflineAnswer(item);
    setOfflineQueue(next);
  };

  const handleMarkNotifRead = async (id: string) => {
    if (!session) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id && !n.readByGroupIds.includes(session.groupId)
          ? { ...n, readByGroupIds: [...n.readByGroupIds, session.groupId] }
          : n,
      ),
    );
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id, groupId: session.groupId }),
      });
    } catch {
      // ignore if offline
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
  };

  const unreadCount = session
    ? notifications.filter(
        (n) =>
          n.classId === session.classId &&
          !n.readByGroupIds.includes(session.groupId),
      ).length
    : notifications.length;

  const switchToTeacherPortal = () => {
    window.history.pushState({}, '', '/teacher');
    setPortal('teacher');
    setActiveTab('teacher');
  };

  const switchToStudentPortal = () => {
    window.history.pushState({}, '', '/');
    setPortal('student');
    setActiveTab(session ? 'play' : 'identity');
  };

  const handleTeacherUnlocked = () => {
    window.sessionStorage.setItem(TEACHER_UNLOCK_KEY, '1');
    setTeacherUnlocked(true);
    setActiveTab('teacher');
  };

  const handleLockTeacherPortal = () => {
    window.sessionStorage.removeItem(TEACHER_UNLOCK_KEY);
    setTeacherUnlocked(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopNav
        portal={portal}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        session={session}
        copy={copy}
        lang={lang}
        onQuickSwitchShift={() => setActiveTab('identity')}
        onSwitchToStudentPortal={switchToStudentPortal}
      />

      {/* Workspace Utility Toolbar (below header, clean controls) */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <button
                type="button"
                onClick={() => setLang('vi')}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                  lang === 'vi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                English
              </button>
            </div>

            {/* Visual/Icon Mode Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <Smile className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <button
                type="button"
                onClick={() => setUiMode('kid')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  uiMode === 'kid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {copy.kidModeLabel}
              </button>
              <button
                type="button"
                onClick={() => setUiMode('standard')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  uiMode === 'standard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {copy.standardModeLabel}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Offline Sync Control & Simulator */}
            <button
              type="button"
              onClick={() => setSimulateOffline((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium cursor-pointer ${
                isOfflineEffective
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isOfflineEffective ? (
                <WifiOff className="w-3.5 h-3.5" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>
                {isOfflineEffective
                  ? copy.offlineSimulatedLabel
                  : copy.offlineReadyLabel}
              </span>
            </button>

            {offlineQueue.length > 0 && (
              <button
                type="button"
                disabled={isOfflineEffective || syncing}
                onClick={handleSyncNow}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 text-white font-semibold disabled:opacity-50 cursor-pointer tabular-nums"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>
                  {offlineQueue.length} {copy.pendingSyncLabel} · {copy.syncNowBtn}
                </span>
              </button>
            )}

            {/* Push Notification Center Trigger */}
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer tabular-nums"
            >
              <Bell className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {lang === 'vi' ? 'Thông báo' : 'Alerts'} ({unreadCount})
              </span>
            </button>
          </div>
        </div>
      </div>

      {syncNotice && (
        <div
          role="status"
          className="bg-emerald-600 text-white text-xs sm:text-sm font-semibold py-2 px-4 text-center"
        >
          {syncNotice}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {portal === 'teacher' ? (
          !teacherUnlocked ? (
            <TeacherPinGate
              onUnlocked={handleTeacherUnlocked}
              onBackToStudent={switchToStudentPortal}
              lang={lang}
            />
          ) : activeTab === 'honor' ? (
            <HonorBoard
              classes={classes}
              selectedClassId={honorClassId}
              onChangeClass={(cid) => setHonorClassId(cid)}
              leaderboard={leaderboard}
              domainChampions={domainChampions}
              copy={copy}
              lang={lang}
            />
          ) : (
            <TeacherStudio
              classes={classes}
              lessons={lessons}
              competencyMatrix={competencyMatrix}
              activityLogs={activityLogs}
              submissions={submissions}
              notifications={notifications}
              sharedAppUrl={sharedAppUrl}
              selectedClassId={activeClassId}
              onRefreshData={fetchBootstrap}
              onLockTeacherPortal={handleLockTeacherPortal}
              onSelectLessonForPlay={(lid) => {
                if (!session) {
                  setSession({
                    classId: classes[0]?.id || 'LOP-5A',
                    tabletNumber: 1,
                    groupName: 'Sao Xanh',
                    groupId: 'Máy-01 · Sao Xanh',
                  });
                }
                window.history.pushState({}, '', '/');
                setPortal('student');
                setSelectedLessonId(lid);
                setActiveTab('play');
              }}
              copy={copy}
              lang={lang}
            />
          )
        ) : (
          <>
            {activeTab === 'identity' && (
              <IdentityGate
                classes={classes}
                activeSession={session}
                initialClassId={entryParams.classId}
                initialTabletNumber={entryParams.tabletNumber}
                onConfirmSession={handleConfirmSession}
                onClearSession={handleClearSession}
                copy={copy}
                lang={lang}
                uiMode={uiMode}
              />
            )}

            {activeTab === 'play' && (
              <StudentArena
                session={session}
                lessons={lessons}
                selectedLessonId={selectedLessonId}
                onSelectLesson={setSelectedLessonId}
                notifications={notifications}
                onGoToIdentity={() => setActiveTab('identity')}
                onGoToHonorBoard={() => {
                  if (session) setHonorClassId(session.classId);
                  setActiveTab('honor');
                }}
                isOfflineEffective={isOfflineEffective}
                onOnlineSubmission={() => {
                  fetchBootstrap();
                }}
                onQueueOffline={handleQueueOffline}
                copy={copy}
                lang={lang}
                uiMode={uiMode}
              />
            )}

            {activeTab === 'honor' && (
              <HonorBoard
                classes={classes}
                selectedClassId={honorClassId}
                onChangeClass={(cid) => setHonorClassId(cid)}
                leaderboard={leaderboard}
                domainChampions={domainChampions}
                copy={copy}
                lang={lang}
              />
            )}
          </>
        )}
      </main>

      {portal === 'student' && (
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              {lang === 'vi'
                ? 'Giao diện Học sinh · Công dân số TT 02/2025'
                : 'Student Portal · Digital Citizenship'}
            </span>
            <button
              type="button"
              onClick={switchToTeacherPortal}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-sky-700 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {lang === 'vi'
                  ? 'Cổng Giáo Viên (Yêu cầu mã PIN)'
                  : 'Teacher Portal (PIN required)'}
              </span>
            </button>
          </div>
        </footer>
      )}

      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        currentGroupId={session?.groupId}
        onMarkRead={handleMarkNotifRead}
        onJumpToLesson={(lid) => {
          setSelectedLessonId(lid);
          if (portal === 'teacher') {
            window.history.pushState({}, '', '/');
            setPortal('student');
          }
          setActiveTab('play');
        }}
        browserPermission={browserPermission}
        onRequestBrowserPermission={handleRequestBrowserPermission}
        copy={copy}
        lang={lang}
      />
    </div>
  );
}
