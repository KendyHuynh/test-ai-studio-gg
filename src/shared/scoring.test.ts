import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompetencyMatrix,
  buildDomainChampions,
  buildLeaderboard,
  calculatePoints,
  computeSkillLevelTitle,
  formatGroupId,
  isAnswerMatch,
} from './scoring';
import { AnswerSubmission, Lesson } from './types';

test('calculatePoints awards base + speed bonus when correct and 0 when wrong', () => {
  const fast = calculatePoints(true, 4000);
  assert.equal(fast.basePoints, 100);
  assert.equal(fast.speedBonus, 50);
  assert.equal(fast.totalPoints, 150);

  const medium = calculatePoints(true, 26500);
  assert.equal(medium.basePoints, 100);
  assert.ok(medium.speedBonus > 0 && medium.speedBonus < 50);

  const wrong = calculatePoints(false, 2000);
  assert.equal(wrong.totalPoints, 0);
  assert.equal(wrong.speedBonus, 0);
});

test('isAnswerMatch handles Vietnamese diacritics, punctuation, and fill_blank phrases', () => {
  assert.equal(isAnswerMatch('Mật khẩu mạnh!', 'Mật khẩu mạnh', 'multiple_choice'), true);
  assert.equal(
    isAnswerMatch('Em sẽ dùng xác thực hai yếu tố để bảo vệ', 'xác thực hai yếu tố', 'fill_blank'),
    true,
  );
  assert.equal(isAnswerMatch('Chia sẻ mật khẩu cho bạn', 'Không chia sẻ mật khẩu', 'short_answer'), false);
});

test('buildLeaderboard ranks groups by total score then accuracy then speed', () => {
  const subs: AnswerSubmission[] = [
    {
      id: '1',
      classId: 'LOP-5A',
      groupId: formatGroupId(1, 'Sao Xanh'),
      tabletNumber: 1,
      groupName: 'Sao Xanh',
      lessonId: 'L1',
      lessonTitle: 'An toàn mạng',
      questionId: 'Q1',
      competencyId: '4.2',
      userAnswer: 'A',
      isCorrect: true,
      basePoints: 100,
      speedBonus: 40,
      totalPoints: 140,
      elapsedMs: 10000,
      submittedAt: '2026-11-16T08:00:00Z',
      feedbackText: 'Tuyệt vời!',
      explanation: 'Bảo vệ dữ liệu cá nhân',
    },
    {
      id: '2',
      classId: 'LOP-5A',
      groupId: formatGroupId(2, 'Mặt Trời'),
      tabletNumber: 2,
      groupName: 'Mặt Trời',
      lessonId: 'L1',
      lessonTitle: 'An toàn mạng',
      questionId: 'Q1',
      competencyId: '6.2',
      userAnswer: 'B',
      isCorrect: true,
      basePoints: 100,
      speedBonus: 50,
      totalPoints: 150,
      elapsedMs: 5000,
      submittedAt: '2026-11-16T08:00:05Z',
      feedbackText: 'Xuất sắc!',
      explanation: 'Dùng AI có đạo đức',
    },
  ];

  const board = buildLeaderboard('LOP-5A', subs, 'vi');
  assert.equal(board.length, 2);
  assert.equal(board[0].Rank, 1);
  assert.equal(board[0].groupName, 'Mặt Trời');
  assert.equal(board[0].Score, 150);
  assert.equal(board[0].SkillLevel, 'Bậc thầy Ứng dụng AI');
  assert.equal(board[1].Rank, 2);
  assert.equal(board[1].SkillLevel, 'Chiến thần Bảo mật dữ liệu');

  const champions = buildDomainChampions('LOP-5A', subs, 'vi');
  assert.equal(champions.length, 2);
  assert.equal(champions[0].honorTitle, 'Bậc thầy Ứng dụng AI');
  assert.equal(champions[0].skillTierLabel, 'Cấp độ Chuyên gia Tốc độ');
});

test('computeSkillLevelTitle returns domain-specific honor title', () => {
  const subs: AnswerSubmission[] = [
    {
      id: '1',
      classId: 'LOP-5A',
      groupId: 'Máy-03 · Tia Chớp',
      tabletNumber: 3,
      groupName: 'Tia Chớp',
      lessonId: 'L1',
      lessonTitle: 'Bài 1',
      questionId: 'Q1',
      competencyId: '4.2',
      userAnswer: 'A',
      isCorrect: true,
      basePoints: 100,
      speedBonus: 30,
      totalPoints: 130,
      elapsedMs: 12000,
      submittedAt: '2026-11-16T08:00:00Z',
      feedbackText: 'Hay lắm!',
      explanation: 'OK',
    },
  ];
  const res = computeSkillLevelTitle(subs, 'vi');
  assert.equal(res.title, 'Chiến thần Bảo mật dữ liệu');
  assert.equal(res.topDomainId, '4');
});

test('buildCompetencyMatrix aggregates multi-competency questions across 24 competencies', () => {
  const lessons: Lesson[] = [
    {
      id: 'L1',
      title: 'Test',
      topic: 'AI',
      sourceFileName: 'test.txt',
      summary: 'Summary',
      assignedClassIds: ['LOP-5A'],
      createdAt: '2026-11-16T00:00:00Z',
      questions: [
        {
          id: 'Q1',
          type: 'multiple_choice',
          questionText: 'Q?',
          options: ['A', 'B'],
          aiSearchKeywordHint: 'AI ethics',
          correctAnswer: 'A',
          competencyId: '6.2',
          competencyIds: ['6.2', '2.3'],
          explanation: 'Exp',
        },
      ],
    },
  ];
  const matrix = buildCompetencyMatrix(lessons, []);
  assert.equal(matrix.length, 24);
  const comp62 = matrix.find((m) => m.competencyId === '6.2');
  const comp23 = matrix.find((m) => m.competencyId === '2.3');
  assert.equal(comp62?.questionCount, 1);
  assert.equal(comp23?.questionCount, 1);
  assert.equal(comp62?.accuracyPercent, null);
});
