import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCOPES,
  buildDriveSearchQuery,
  getWorkspaceExportConfig,
  isTextReadableFile,
} from './driveHelpers.ts';

test('SCOPES includes all configured Google Drive scopes', () => {
  assert.equal(SCOPES.length, 13);
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/drive'));
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/drive.readonly'));
});

test('buildDriveSearchQuery excludes folders and trashed files and escapes quotes', () => {
  const base = buildDriveSearchQuery('');
  assert.ok(base.includes('trashed = false'));
  assert.ok(base.includes("mimeType != 'application/vnd.google-apps.folder'"));

  const withTerm = buildDriveSearchQuery("Bài 'Công dân số'");
  assert.ok(withTerm.includes("name contains 'Bài \\'Công dân số\\''"));
});

test('getWorkspaceExportConfig maps Docs, Slides, Sheets and regular PDFs properly', () => {
  assert.deepEqual(
    getWorkspaceExportConfig('application/vnd.google-apps.document'),
    { isWorkspaceDoc: true, exportMimeType: 'text/plain' },
  );
  assert.deepEqual(
    getWorkspaceExportConfig('application/vnd.google-apps.spreadsheet'),
    { isWorkspaceDoc: true, exportMimeType: 'text/csv' },
  );
  assert.deepEqual(getWorkspaceExportConfig('application/pdf'), {
    isWorkspaceDoc: false,
  });
  assert.equal(isTextReadableFile('lesson.md', 'application/octet-stream'), true);
  assert.equal(isTextReadableFile('lesson.pdf', 'application/pdf'), false);
});
