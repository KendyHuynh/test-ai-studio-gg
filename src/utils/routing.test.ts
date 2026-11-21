import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentJoinUrl,
  buildTeacherPortalUrl,
  parseEntryParams,
  resolveShareableOrigin,
} from './routing';

test('parseEntryParams detects student join links with class, tablet, and ws params', () => {
  const res = parseEntryParams('/', '?class=lop-5b&tablet=4&ws=WS-1234ABCD');
  assert.equal(res.portal, 'student');
  assert.equal(res.classId, 'LOP-5B');
  assert.equal(res.tabletNumber, 4);
  assert.equal(res.workspaceCode, 'WS-1234ABCD');
});

test('parseEntryParams detects teacher portal via /teacher or ?role=teacher', () => {
  assert.equal(parseEntryParams('/teacher', '').portal, 'teacher');
  assert.equal(parseEntryParams('/giao-vien', '').portal, 'teacher');
  assert.equal(parseEntryParams('/', '?role=teacher').portal, 'teacher');
});

test('resolveShareableOrigin rewrites ais-dev- URLs to public ais-pre- Share App URLs', () => {
  assert.equal(
    resolveShareableOrigin('https://ais-dev-74lhqf4gdw7r3g5pnltlxr-197088726295.asia-southeast1.run.app'),
    'https://ais-pre-74lhqf4gdw7r3g5pnltlxr-197088726295.asia-southeast1.run.app',
  );
  assert.equal(
    resolveShareableOrigin('http://localhost:3000'),
    'http://localhost:3000',
  );
});

test('buildStudentJoinUrl and buildTeacherPortalUrl generate clean URLs', () => {
  assert.equal(
    buildStudentJoinUrl('https://edubot.example.com/', 'lop-6a'),
    'https://edubot.example.com/?class=LOP-6A',
  );
  assert.equal(
    buildStudentJoinUrl('https://edubot.example.com', 'LOP-5A', 7, 'WS-ABC123'),
    'https://edubot.example.com/?class=LOP-5A&tablet=7&ws=WS-ABC123',
  );
  assert.equal(
    buildTeacherPortalUrl('https://edubot.example.com/'),
    'https://edubot.example.com/teacher',
  );
});
