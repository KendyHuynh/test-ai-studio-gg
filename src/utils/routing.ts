export type AppPortal = 'student' | 'teacher';

export interface ParsedEntryParams {
  portal: AppPortal;
  classId: string | null;
  tabletNumber: number | null;
  autostart: boolean;
  workspaceCode: string | null;
}

export function parseEntryParams(pathname: string, search: string): ParsedEntryParams {
  const params = new URLSearchParams(search);
  const roleParam = params.get('role') || params.get('mode');
  const isTeacherPath = pathname.startsWith('/teacher') || pathname.startsWith('/giao-vien');
  const portal: AppPortal =
    isTeacherPath || roleParam === 'teacher' ? 'teacher' : 'student';

  const rawClass = params.get('class') || params.get('join') || params.get('classId');
  const classId = rawClass ? rawClass.trim().toUpperCase() : null;

  const rawTablet = params.get('tablet');
  const parsedTablet = rawTablet ? Number(rawTablet) : NaN;
  const tabletNumber =
    Number.isInteger(parsedTablet) && parsedTablet >= 1 && parsedTablet <= 10
      ? parsedTablet
      : null;

  const autostart = params.get('autostart') === '1';

  const rawWs = params.get('ws') || params.get('workspace');
  const workspaceCode =
    rawWs && /^[A-Za-z0-9_-]{2,64}$/.test(rawWs.trim()) ? rawWs.trim() : null;

  return { portal, classId, tabletNumber, autostart, workspaceCode };
}

/**
 * Converts AI Studio development origin (ais-dev-*) to the public Shared App origin (ais-pre-*)
 * so links copied by the teacher always open for students without developer login.
 */
export function resolveShareableOrigin(
  currentOrigin: string,
  serverSharedAppUrl?: string,
): string {
  const cleanCurrent = (currentOrigin || '').replace(/\/+$/, '');
  if (cleanCurrent.includes('ais-dev-')) {
    return cleanCurrent.replace('ais-dev-', 'ais-pre-');
  }
  if (
    serverSharedAppUrl &&
    serverSharedAppUrl.startsWith('http') &&
    !cleanCurrent.startsWith('http://localhost') &&
    !cleanCurrent.startsWith('http://127.0.0.1')
  ) {
    return serverSharedAppUrl.replace(/\/+$/, '').replace('ais-dev-', 'ais-pre-');
  }
  return cleanCurrent || 'http://localhost:3000';
}

export function buildStudentJoinUrl(
  origin: string,
  classId: string,
  tabletNumber?: number,
  workspaceCode?: string | null,
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('class', classId.trim().toUpperCase());
  if (tabletNumber && tabletNumber >= 1 && tabletNumber <= 10) {
    params.set('tablet', String(tabletNumber));
  }
  if (workspaceCode && /^[A-Za-z0-9_-]{2,64}$/.test(workspaceCode.trim())) {
    params.set('ws', workspaceCode.trim());
  }
  return `${cleanOrigin}/?${params.toString()}`;
}

export function buildTeacherPortalUrl(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/teacher`;
}
