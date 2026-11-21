import { COMPETENCIES_24, COMPETENCY_DOMAINS, getDomainByCompetencyId } from './competencies';
import {
  AnswerSubmission,
  Language,
  LeaderboardEntry,
  Lesson,
  QuestionType,
} from './types';

export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"'()\[\]]/g, '')
    .replace(/\s+/g, ' ');
}

const NEGATION_TOKENS = new Set([
  'không',
  'đừng',
  'tránh',
  'chưa',
  'chớ',
  'cấm',
  'not',
  'never',
  'no',
  'dont',
  "don't",
]);

export function isAnswerMatch(
  userAnswer: string,
  correctAnswer: string,
  type: QuestionType,
): boolean {
  const normUser = normalizeAnswer(userAnswer);
  const normCorrect = normalizeAnswer(correctAnswer);
  if (!normUser || !normCorrect) {
    return false;
  }
  if (normUser === normCorrect) {
    return true;
  }
  if (type === 'fill_blank' || type === 'short_answer') {
    const refTokens = normCorrect.split(' ').filter((t) => t.length > 1);
    const userTokensList = normUser.split(' ').filter((t) => t.length > 1);
    const userTokens = new Set(userTokensList);

    // Ensure negation polarity matches
    const refNegCount = refTokens.filter((t) => NEGATION_TOKENS.has(t)).length;
    const userNegCount = userTokensList.filter((t) => NEGATION_TOKENS.has(t)).length;
    if (refNegCount !== userNegCount) {
      return false;
    }

    // Allow substring match if the student wrote a complete phrase containing the key answer
    if (normCorrect.length >= 3 && normUser.includes(normCorrect)) {
      return true;
    }
    // Check token overlap (>= 75% of reference keywords present)
    if (refTokens.length >= 2) {
      const matched = refTokens.filter((t) => userTokens.has(t)).length;
      return matched / refTokens.length >= 0.75;
    }
  }
  return false;
}

export interface PointsBreakdown {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
}

/**
 * Standard accuracy points = 100.
 * Fast-response bonus: up to +50 when answered accurately within 45 seconds.
 * Wrong answer = 0 points.
 */
export function calculatePoints(isCorrect: boolean, elapsedMs: number): PointsBreakdown {
  if (!isCorrect) {
    return { basePoints: 0, speedBonus: 0, totalPoints: 0 };
  }
  const safeMs = Math.max(500, Math.min(elapsedMs, 120000));
  const basePoints = 100;
  let speedBonus = 0;
  if (safeMs <= 8000) {
    speedBonus = 50;
  } else if (safeMs <= 45000) {
    const ratio = 1 - (safeMs - 8000) / (45000 - 8000);
    speedBonus = Math.round(ratio * 45);
  }
  return {
    basePoints,
    speedBonus,
    totalPoints: basePoints + speedBonus,
  };
}

export function formatGroupId(tabletNumber: number, groupName: string): string {
  const pad = String(tabletNumber).padStart(2, '0');
  const cleanName = groupName.trim() || `Nhóm ${pad}`;
  return `Máy-${pad} · ${cleanName}`;
}

export function computeSkillLevelTitle(
  submissions: AnswerSubmission[],
  lang: Language = 'vi',
): { title: string; topDomainId: string } {
  if (submissions.length === 0) {
    return {
      title: lang === 'vi' ? 'Tân binh Công dân Số' : 'Digital Citizen Rookie',
      topDomainId: '1',
    };
  }

  const domainScores = new Map<string, { correct: number; total: number; points: number }>();
  for (const sub of submissions) {
    const compList =
      sub.competencyIds && sub.competencyIds.length > 0
        ? sub.competencyIds
        : [sub.competencyId];
    for (const cid of compList) {
      const domain = getDomainByCompetencyId(cid);
      const prev = domainScores.get(domain.id) ?? { correct: 0, total: 0, points: 0 };
      domainScores.set(domain.id, {
        correct: prev.correct + (sub.isCorrect ? 1 : 0),
        total: prev.total + 1,
        points: prev.points + sub.totalPoints,
      });
    }
  }

  const totalCorrect = submissions.filter((s) => s.isCorrect).length;
  const accuracy = totalCorrect / submissions.length;
  const avgMs =
    submissions.reduce((acc, s) => acc + s.elapsedMs, 0) / submissions.length;

  let bestDomainId = '1';
  let bestMetric = -1;
  for (const [domainId, stats] of domainScores.entries()) {
    const metric = stats.points + stats.correct * 20;
    if (metric > bestMetric) {
      bestMetric = metric;
      bestDomainId = domainId;
    }
  }

  if (domainScores.size >= 4 && accuracy >= 0.85 && avgMs <= 20000) {
    return {
      title: lang === 'vi' ? 'Công dân Số Toàn năng' : 'All-Star Digital Citizen',
      topDomainId: bestDomainId,
    };
  }

  const domainInfo =
    COMPETENCY_DOMAINS.find((d) => d.id === bestDomainId) ?? COMPETENCY_DOMAINS[0];

  if (accuracy < 0.5) {
    return {
      title:
        lang === 'vi'
          ? `Nhà Khám phá ${domainInfo.nameVi}`
          : `${domainInfo.nameEn} Explorer`,
      topDomainId: bestDomainId,
    };
  }

  return {
    title: lang === 'vi' ? domainInfo.honorTitleVi : domainInfo.honorTitleEn,
    topDomainId: bestDomainId,
  };
}

export function buildLeaderboard(
  classId: string,
  submissions: AnswerSubmission[],
  lang: Language = 'vi',
): LeaderboardEntry[] {
  const classSubs = submissions.filter((s) => s.classId === classId);
  const byGroup = new Map<string, AnswerSubmission[]>();

  for (const sub of classSubs) {
    const list = byGroup.get(sub.groupId) ?? [];
    list.push(sub);
    byGroup.set(sub.groupId, list);
  }

  const entries: Omit<LeaderboardEntry, 'Rank'>[] = [];
  for (const [groupId, subs] of byGroup.entries()) {
    const totalScore = subs.reduce((sum, s) => sum + s.totalPoints, 0);
    const correctCount = subs.filter((s) => s.isCorrect).length;
    const totalAnswered = subs.length;
    const accuracyPercent =
      totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const avgElapsedMs =
      totalAnswered > 0
        ? Math.round(subs.reduce((sum, s) => sum + s.elapsedMs, 0) / totalAnswered)
        : 0;
    const skill = computeSkillLevelTitle(subs, lang);
    const latest = subs[subs.length - 1];

    entries.push({
      ClassID: classId,
      GroupID: groupId,
      tabletNumber: latest.tabletNumber,
      groupName: latest.groupName,
      Score: totalScore,
      SkillLevel: skill.title,
      correctCount,
      totalAnswered,
      accuracyPercent,
      avgElapsedMs,
      topDomainId: skill.topDomainId,
    });
  }

  entries.sort((a, b) => {
    if (b.Score !== a.Score) return b.Score - a.Score;
    if (b.accuracyPercent !== a.accuracyPercent) return b.accuracyPercent - a.accuracyPercent;
    return a.avgElapsedMs - b.avgElapsedMs;
  });

  return entries.map((entry, idx) => ({
    ...entry,
    Rank: idx + 1,
  }));
}

export interface CompetencyCoverageStat {
  competencyId: string;
  questionCount: number;
  attemptCount: number;
  correctCount: number;
  accuracyPercent: number | null;
}

export function buildCompetencyMatrix(
  lessons: Lesson[],
  submissions: AnswerSubmission[],
  classId?: string,
): CompetencyCoverageStat[] {
  const filteredSubs = classId
    ? submissions.filter((s) => s.classId === classId)
    : submissions;

  return COMPETENCIES_24.map((comp) => {
    const questionCount = lessons.reduce(
      (sum, lesson) =>
        sum +
        lesson.questions.filter((q) => {
          const list =
            q.competencyIds && q.competencyIds.length > 0
              ? q.competencyIds
              : [q.competencyId];
          return list.includes(comp.id);
        }).length,
      0,
    );
    const attempts = filteredSubs.filter((s) => {
      const list =
        s.competencyIds && s.competencyIds.length > 0
          ? s.competencyIds
          : [s.competencyId];
      return list.includes(comp.id);
    });
    const correctCount = attempts.filter((s) => s.isCorrect).length;
    const accuracyPercent =
      attempts.length > 0 ? Math.round((correctCount / attempts.length) * 100) : null;

    return {
      competencyId: comp.id,
      questionCount,
      attemptCount: attempts.length,
      correctCount,
      accuracyPercent,
    };
  });
}

export interface DomainHonorAward {
  domainId: string;
  domainName: string;
  honorTitle: string;
  groupId: string;
  domainScore: number;
  accuracyPercent: number;
  avgElapsedMs: number;
  skillTierLabel: string;
}

export function buildDomainChampions(
  classId: string,
  submissions: AnswerSubmission[],
  lang: Language = 'vi',
): DomainHonorAward[] {
  const classSubs = submissions.filter((s) => s.classId === classId);
  const awards: DomainHonorAward[] = [];

  for (const domain of COMPETENCY_DOMAINS) {
    const byGroup = new Map<string, AnswerSubmission[]>();
    for (const sub of classSubs) {
      const compList =
        sub.competencyIds && sub.competencyIds.length > 0
          ? sub.competencyIds
          : [sub.competencyId];
      const touchesDomain = compList.some(
        (cid) => getDomainByCompetencyId(cid).id === domain.id,
      );
      if (touchesDomain) {
        const arr = byGroup.get(sub.groupId) ?? [];
        arr.push(sub);
        byGroup.set(sub.groupId, arr);
      }
    }

    let winner: DomainHonorAward | null = null;
    for (const [groupId, subs] of byGroup.entries()) {
      const domainScore = subs.reduce((sum, s) => sum + s.totalPoints, 0);
      const correct = subs.filter((s) => s.isCorrect).length;
      const accuracyPercent = Math.round((correct / subs.length) * 100);
      const avgElapsedMs = Math.round(
        subs.reduce((sum, s) => sum + s.elapsedMs, 0) / subs.length,
      );
      if (domainScore <= 0) continue;

      const skillTierLabel =
        accuracyPercent === 100 && avgElapsedMs <= 12000
          ? lang === 'vi'
            ? 'Cấp độ Chuyên gia Tốc độ'
            : 'Master Speed Tier'
          : accuracyPercent >= 80
            ? lang === 'vi'
              ? 'Cấp độ Thành thạo'
              : 'Proficient Tier'
            : lang === 'vi'
              ? 'Cấp độ Khám phá'
              : 'Explorer Tier';

      if (
        !winner ||
        domainScore > winner.domainScore ||
        (domainScore === winner.domainScore && avgElapsedMs < winner.avgElapsedMs)
      ) {
        winner = {
          domainId: domain.id,
          domainName: lang === 'vi' ? domain.nameVi : domain.nameEn,
          honorTitle: lang === 'vi' ? domain.honorTitleVi : domain.honorTitleEn,
          groupId,
          domainScore,
          accuracyPercent,
          avgElapsedMs,
          skillTierLabel,
        };
      }
    }

    if (winner) {
      awards.push(winner);
    }
  }

  return awards.sort((a, b) => b.domainScore - a.domainScore);
}
