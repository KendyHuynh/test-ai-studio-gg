import { Bell, CheckCircle2, X } from 'lucide-react';
import { CopyDict } from '../shared/i18n';
import { Language, PushNotification } from '../shared/types';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: PushNotification[];
  currentGroupId?: string;
  onMarkRead: (id: string) => void;
  onJumpToLesson: (lessonId: string) => void;
  browserPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  copy: CopyDict;
  lang: Language;
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  currentGroupId,
  onMarkRead,
  onJumpToLesson,
  browserPermission,
  onRequestBrowserPermission,
  copy,
  lang,
}: NotificationDrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={copy.notificationsTitle}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              {copy.notificationsTitle}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {browserPermission === 'granted'
              ? lang === 'vi'
                ? 'Thông báo đẩy trình duyệt đang bật cho máy tính bảng này.'
                : 'Browser push alerts are active on this tablet.'
              : lang === 'vi'
                ? 'Bật thông báo đẩy để nhận tin ngay khi giáo viên giao bài mới.'
                : 'Enable push alerts to receive instant new assignment notices.'}
          </p>
          {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestBrowserPermission}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.enablePushBtn}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {lang === 'vi'
                ? 'Chưa có thông báo bài tập mới cho lớp này.'
                : 'No new assignment notifications for this class yet.'}
            </div>
          ) : (
            notifications.map((n) => {
              const isRead = currentGroupId
                ? n.readByGroupIds.includes(currentGroupId)
                : false;
              return (
                <div key={n.id} className="p-5 space-y-2 hover:bg-slate-50/70">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-sky-700">{n.classId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {new Date(n.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isRead && (
                      <span className="ml-auto inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Đã xem' : 'Read'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{n.message}</p>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onMarkRead(n.id);
                        onJumpToLesson(n.lessonId);
                        onClose();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                    >
                      {lang === 'vi' ? 'Mở bài học ngay' : 'Open Lesson'}
                    </button>
                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(n.id)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        {lang === 'vi' ? 'Đánh dấu đã đọc' : 'Mark read'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
