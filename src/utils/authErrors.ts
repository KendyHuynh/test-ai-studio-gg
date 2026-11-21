import { Language } from '../shared/types';

export interface FormattedAuthError {
  code: string | null;
  message: string;
  suggestNewTab: boolean;
}

export function extractFirebaseAuthCode(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\((auth\/[a-z0-9-]+)\)/i);
  if (match) return match[1].toLowerCase();
  if (msg.includes('auth/')) {
    const inline = msg.match(/auth\/[a-z0-9-]+/i);
    if (inline) return inline[0].toLowerCase();
  }
  return null;
}

export function formatFirebaseAuthError(err: unknown, lang: Language): FormattedAuthError {
  const code = extractFirebaseAuthCode(err);

  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      suggestNewTab: true,
      message:
        lang === 'vi'
          ? 'Cửa sổ đăng nhập Google đã đóng trước khi hoàn tất. Vui lòng nhấn thử lại và giữ cửa sổ bật lên mở đến khi chọn tài khoản xong (hoặc mở trang ở tab mới nếu trình duyệt hạn chế pop-up trong khung nhúng).'
          : 'The Google sign-in popup was closed before completing. Please try again and keep the popup open until sign-in finishes, or open this page in a new tab.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      suggestNewTab: true,
      message:
        lang === 'vi'
          ? 'Trình duyệt đang chặn cửa sổ đăng nhập Google (pop-up). Hãy cho phép pop-up cho trang này hoặc mở ứng dụng ở tab mới rồi đăng nhập lại.'
          : 'Your browser blocked the Google sign-in popup. Please allow popups for this site or open the app in a new tab.',
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      suggestNewTab: false,
      message:
        lang === 'vi'
          ? 'Đang có một yêu cầu đăng nhập khác chưa hoàn tất. Vui lòng đóng cửa sổ cũ (nếu có) và thử lại.'
          : 'Another sign-in popup request is already in progress. Please try again.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      suggestNewTab: false,
      message:
        lang === 'vi'
          ? 'Không thể kết nối máy chủ đăng nhập Google do lỗi mạng. Vui lòng kiểm tra Wi-Fi và thử lại.'
          : 'Network error while contacting Google sign-in. Please check your connection and try again.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      suggestNewTab: true,
      message:
        lang === 'vi'
          ? 'Tên miền hiện tại chưa được cấp phép đăng nhập Google. Vui lòng mở bằng URL triển khai chính thức hoặc kiểm tra Firebase Auth.'
          : 'This domain is not authorized for Firebase Google Sign-In. Please open the official app URL.',
    };
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');
  return {
    code,
    suggestNewTab: false,
    message:
      raw ||
      (lang === 'vi'
        ? 'Đăng nhập Google chưa thành công. Vui lòng thử lại.'
        : 'Google sign-in failed. Please try again.'),
  };
}
