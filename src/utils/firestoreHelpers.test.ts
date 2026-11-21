import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromFirestoreRestValue,
  normalizeClassCode,
  sanitizeLessonFieldsForFirestore,
  toFirestoreDocId,
} from './firestoreHelpers';
import { Lesson } from '../shared/types';

test('toFirestoreDocId strips Vietnamese diacritics and invalid chars', () => {
  assert.equal(toFirestoreDocId('LỚP-8A'), 'LOP-8A');
  assert.equal(toFirestoreDocId('Đội Sao Đỏ #1'), 'Doi-Sao-Do-1');
  assert.equal(toFirestoreDocId('lesson-123_abc'), 'lesson-123_abc');
});

test('normalizeClassCode produces uppercase ASCII class IDs', () => {
  assert.equal(normalizeClassCode('Lớp 6B'), 'LOP-6B');
  assert.equal(normalizeClassCode('  đội-tuyển_9a '), 'DOI-TUYEN_9A');
});

test('sanitizeLessonFieldsForFirestore removes undefined options on fill_blank and keeps 15+ questions', () => {
  const sampleLesson: Lesson = {
    id: 'lesson-test',
    title: 'An toàn số',
    topic: 'Công dân số',
    sourceFileName: 'test.txt',
    summary: 'Tóm tắt',
    assignedClassIds: ['LOP-5A'],
    createdAt: '2026-01-01T00:00:00.000Z',
    questions: Array.from({ length: 15 }, (_, idx) => ({
      id: `q-${idx + 1}`,
      type: idx % 2 === 0 ? 'multiple_choice' : 'fill_blank',
      questionText: `Câu ${idx + 1}`,
      options: idx % 2 === 0 ? ['A', 'B', 'C', 'D'] : undefined,
      aiSearchKeywordHint: 'từ khóa',
      correctAnswer: 'A',
      competencyId: '4.2',
      competencyIds: ['4.2'],
      explanation: 'Giải thích',
    })),
  };

  const sanitized = sanitizeLessonFieldsForFirestore(sampleLesson, 'lesson-test');
  assert.equal(sanitized.questions.length, 15);
  assert.deepEqual(sanitized.questions[0].options, ['A', 'B', 'C', 'D']);
  assert.equal('options' in sanitized.questions[1], false);
});

test('fromFirestoreRestValue decodes nested maps, arrays, integers, and booleans', () => {
  const decoded = fromFirestoreRestValue({
    mapValue: {
      fields: {
        id: { stringValue: 'LOP-5A' },
        count: { integerValue: '15' },
        active: { booleanValue: true },
        tags: { arrayValue: { values: [{ stringValue: '4.2' }, { stringValue: '6.2' }] } },
      },
    },
  });
  assert.deepEqual(decoded, {
    id: 'LOP-5A',
    count: 15,
    active: true,
    tags: ['4.2', '6.2'],
  });
});
