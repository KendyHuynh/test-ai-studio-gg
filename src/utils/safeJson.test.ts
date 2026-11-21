import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HtmlInsteadOfJsonError,
  looksLikeHtml,
  parseJsonTextSafe,
  readJsonSafe,
} from './safeJson';

test('looksLikeHtml detects <!doctype html> and <html> payloads', () => {
  assert.equal(looksLikeHtml('<!doctype html>\n<html>...</html>'), true);
  assert.equal(looksLikeHtml('   <HTML><BODY>Error</BODY></HTML>'), true);
  assert.equal(looksLikeHtml('{"ok":true}'), false);
});

test('readJsonSafe parses valid JSON responses cleanly', async () => {
  const res = new Response(JSON.stringify({ ok: true, count: 15 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const parsed = await readJsonSafe<{ ok: boolean; count: number }>(res, 'vi');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.count, 15);
});

test('readJsonSafe throws HtmlInsteadOfJsonError instead of SyntaxError when receiving <!doctype html>', async () => {
  const res = new Response('<!doctype html><html><body>SPA</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  await assert.rejects(
    () => readJsonSafe(res, 'vi'),
    (err: unknown) => err instanceof HtmlInsteadOfJsonError,
  );
});

test('parseJsonTextSafe rejects HTML file contents with HtmlInsteadOfJsonError', () => {
  assert.throws(
    () => parseJsonTextSafe('<!doctype html><html></html>', 'en'),
    (err: unknown) => err instanceof HtmlInsteadOfJsonError,
  );
});
