export class HtmlInsteadOfJsonError extends Error {
  constructor(lang: 'vi' | 'en' = 'vi') {
    super(
      lang === 'vi'
        ? 'Máy chủ trả về trang HTML thay vì dữ liệu JSON (có thể phiên AI Studio vừa hết hạn, hoặc bản Share App chưa cập nhật mới nhất). Hãy tải lại trang (F5) hoặc bấm Share App lại rồi thử lại.'
        : 'Server returned an HTML page instead of JSON (your AI Studio session may have expired or the Share App needs refreshing). Reload the page and try again.',
    );
    this.name = 'HtmlInsteadOfJsonError';
  }
}

export function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body') ||
    trimmed.startsWith('<?xml')
  );
}

export function parseJsonTextSafe<T = unknown>(
  text: string,
  lang: 'vi' | 'en' = 'vi',
): T {
  if (looksLikeHtml(text)) {
    throw new HtmlInsteadOfJsonError(lang);
  }
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      lang === 'vi'
        ? 'Dữ liệu phản hồi không đúng định dạng JSON hợp lệ.'
        : 'Response body is not valid JSON.',
    );
  }
}

export async function readJsonSafe<T = unknown>(
  res: Response,
  lang: 'vi' | 'en' = 'vi',
): Promise<T> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const text = await res.text();

  if (looksLikeHtml(text) || (contentType.includes('text/html') && !text.trimStart().startsWith('{') && !text.trimStart().startsWith('['))) {
    throw new HtmlInsteadOfJsonError(lang);
  }

  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return {} as T;
  }

  return parseJsonTextSafe<T>(text, lang);
}
