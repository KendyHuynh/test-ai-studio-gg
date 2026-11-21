import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DriveFileItem,
  SCOPES,
  arrayBufferToBase64,
  buildDriveSearchQuery,
  getWorkspaceExportConfig,
  isTextReadableFile,
} from './driveHelpers';
import { readJsonSafe } from './safeJson';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const firestoreProvider = new GoogleAuthProvider();
firestoreProvider.setCustomParameters({ prompt: 'select_account' });

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
// Keep OAuth access token strictly in memory (never localStorage/sessionStorage).
let cachedAccessToken: string | null = null;

export function initAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

/**
 * Lightweight Google Sign-In for Firebase Firestore cloud storage (no Drive scopes).
 */
export async function firebaseGoogleSignIn(): Promise<{ user: User } | null> {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, firestoreProvider);
    return { user: result.user };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Full Google Sign-In requesting Google Drive OAuth scopes.
 */
export async function googleSignIn(): Promise<{
  user: User;
  accessToken: string;
} | null> {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không nhận được mã truy cập Google Drive từ phiên đăng nhập.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export async function logoutGoogle(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export async function listDriveFiles(
  accessToken: string,
  searchTerm?: string,
): Promise<DriveFileItem[]> {
  const q = buildDriveSearchQuery(searchTerm);
  const params = new URLSearchParams({
    q,
    pageSize: '24',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API lỗi (${res.status}): ${errText.slice(0, 140)}`);
  }

  const data = await readJsonSafe<{ files?: DriveFileItem[] }>(res, 'vi');
  return data.files ?? [];
}

export async function readDriveFileContent(
  accessToken: string,
  file: DriveFileItem,
): Promise<{
  title: string;
  fileName: string;
  textContent?: string;
  base64Data?: string;
  mimeType?: string;
}> {
  const workspaceExport = getWorkspaceExportConfig(file.mimeType);
  const cleanTitle = file.name.replace(/\.[^.]+$/, '');

  if (workspaceExport.isWorkspaceDoc && workspaceExport.exportMimeType) {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      file.id,
    )}/export?mimeType=${encodeURIComponent(workspaceExport.exportMimeType)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Không thể xuất nội dung tệp Google Workspace (${res.status}).`);
    }
    const textContent = await res.text();
    return {
      title: cleanTitle,
      fileName: file.name,
      textContent,
    };
  }

  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    file.id,
  )}?alt=media`;
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Không thể tải tệp từ Google Drive (${res.status}).`);
  }

  if (isTextReadableFile(file.name, file.mimeType)) {
    const textContent = await res.text();
    return {
      title: cleanTitle,
      fileName: file.name,
      textContent,
    };
  }

  const buffer = await res.arrayBuffer();
  return {
    title: cleanTitle,
    fileName: file.name,
    base64Data: arrayBufferToBase64(buffer),
    mimeType: file.mimeType || 'application/pdf',
  };
}

export async function uploadJsonToDrive(
  accessToken: string,
  fileName: string,
  payload: unknown,
): Promise<DriveFileItem> {
  const boundary = 'edubot_drive_boundary_' + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/json',
  });
  const bodyContent = JSON.stringify(payload, null, 2);

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    bodyContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Không thể lưu tệp lên Google Drive (${res.status}): ${errText.slice(0, 140)}`);
  }

  return await readJsonSafe<DriveFileItem>(res, 'vi');
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Không thể xóa tệp trên Google Drive (${res.status}).`);
  }
}
