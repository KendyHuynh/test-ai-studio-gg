export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
] as const;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export function buildDriveSearchQuery(searchTerm?: string): string {
  const baseFilter =
    "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
  const trimmed = (searchTerm ?? '').trim();
  if (!trimmed) return baseFilter;
  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `${baseFilter} and name contains '${escaped}'`;
}

export function getWorkspaceExportConfig(mimeType: string): {
  isWorkspaceDoc: boolean;
  exportMimeType?: string;
} {
  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.presentation'
  ) {
    return { isWorkspaceDoc: true, exportMimeType: 'text/plain' };
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return { isWorkspaceDoc: true, exportMimeType: 'text/csv' };
  }
  return { isWorkspaceDoc: false };
}

export function isTextReadableFile(name: string, mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    /\.(txt|md|csv|json)$/i.test(name)
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
