import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFirebaseAuthCode, formatFirebaseAuthError } from './authErrors';

test('extractFirebaseAuthCode parses Firebase error message and code object', () => {
  assert.equal(
    extractFirebaseAuthCode(new Error('Firebase: Error (auth/popup-closed-by-user).')),
    'auth/popup-closed-by-user',
  );
  assert.equal(
    extractFirebaseAuthCode({ code: 'auth/popup-blocked', message: 'blocked' }),
    'auth/popup-blocked',
  );
  assert.equal(extractFirebaseAuthCode(new Error('Some generic error')), null);
});

test('formatFirebaseAuthError translates auth/popup-closed-by-user into helpful Vietnamese guidance', () => {
  const formatted = formatFirebaseAuthError(
    new Error('Firebase: Error (auth/popup-closed-by-user).'),
    'vi',
  );
  assert.equal(formatted.code, 'auth/popup-closed-by-user');
  assert.equal(formatted.suggestNewTab, true);
  assert.match(formatted.message, /Cửa sổ đăng nhập Google đã đóng/);
});
