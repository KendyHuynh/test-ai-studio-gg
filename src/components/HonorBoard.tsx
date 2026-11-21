import { Award, Download, Medal, ShieldCheck, Trophy } from 'lucide-react';
import { COMPETENCY_DOMAINS } from '../shared/competencies';
import { CopyDict } from '../shared/i18n';
import { DomainHonorAward } from '../shared/scoring';
import { ClassRoom, Language, LeaderboardEntry } from '../shared/types';

interface HonorBoardProps {
  classes: ClassRoom[];
  selectedClassId: string;
  onChangeClass: (classId: string) => void;
  leaderboard: LeaderboardEntry[];
  domainChampions: DomainHonorAward[];
  copy: CopyDict;
  lang: Language;
}

export function HonorBoard({
  classes,
  selectedClassId,
  onChangeClass,
  leaderboard,
  domainChampions,
  copy,
  lang,
}: HonorBoardProps) {
  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      ClassID: selectedClassId,
      rankings: leaderboard.map((row) => ({
        ClassID: row.ClassID,
        GroupID: row.GroupID,
        Score: row.Score,
        Rank: row.Rank,
        SkillLevel: row.SkillLevel,
        AccuracyPercent: row.accuracyPercent,
        AvgTimeSeconds: Number((row.avgElapsedMs / 1000).toFixed(1)),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinh-danh-${selectedClassId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      {/* Header & Class Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-sky-700">
            {lang === 'vi'
              ? 'Bước 4 · Tổng hợp điểm & Bảng vinh danh'
              : 'Step 4 · Class Rankings & Skill Honor Board'}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {copy.leaderboardTitle}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="honor-class-filter" className="text-sm font-medium text-slate-600">
            {lang === 'vi' ? 'Lớp:' : 'Class:'}
          </label>
          <select
            id="honor-class-filter"
            value={selectedClassId}
            onChange={(e) => onChangeClass(e.target.value)}
            className="px-3.5 py-2 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Xuất JSON' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {topThree.map((entry) => {
            const domain =
              COMPETENCY_DOMAINS.find((d) => d.id === entry.topDomainId) ??
              COMPETENCY_DOMAINS[0];
            const rankStyles =
              entry.Rank === 1
                ? 'border-amber-300 bg-amber-50/40'
                : entry.Rank === 2
                  ? 'border-slate-300 bg-slate-50/70'
                  : 'border-orange-200 bg-orange-50/30';

            return (
              <div
                key={entry.GroupID}
                className={`bg-white border rounded-2xl p-6 space-y-4 ${rankStyles}`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    {entry.Rank === 1 ? (
                      <Trophy className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Medal className="w-5 h-5 text-slate-500" />
                    )}
                    <span>
                      {lang === 'vi' ? `Hạng #${entry.Rank}` : `Rank #${entry.Rank}`}
                    </span>
                  </span>
                  <span className="font-mono-num text-xl font-extrabold text-sky-700">
                    {entry.Score} {lang === 'vi' ? 'đ' : 'pts'}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {entry.GroupID}
                  </h2>
                  <p className={`text-sm font-semibold mt-1 ${domain.textClass}`}>
                    {entry.SkillLevel}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                  <span>
                    {lang === 'vi' ? 'Chính xác' : 'Accuracy'}:{' '}
                    <strong className="text-slate-900">{entry.accuracyPercent}%</strong> (
                    {entry.correctCount}/{entry.totalAnswered})
                  </span>
                  <span>
                    {lang === 'vi' ? 'TB' : 'Avg'}:{' '}
                    <strong className="text-slate-900">
                      {(entry.avgElapsedMs / 1000).toFixed(1)}s
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Ranked Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {copy.honorBoardTitle}
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {leaderboard.length}{' '}
            {lang === 'vi' ? 'nhóm tham gia' : 'participating groups'}
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {lang === 'vi'
              ? `Lớp ${selectedClassId} chưa có lượt trả lời nào. Hãy vào mục Trò chơi để ghi điểm đầu tiên!`
              : `No answers recorded yet for ${selectedClassId}. Start a quiz to earn points!`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-6">{lang === 'vi' ? 'Hạng' : 'Rank'}</th>
                  <th className="py-3 px-4">{lang === 'vi' ? 'Nhóm / Máy' : 'GroupID'}</th>
                  <th className="py-3 px-4">{lang === 'vi' ? 'Danh hiệu Vinh danh' : 'SkillLevel'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'vi' ? 'Độ chính xác' : 'Accuracy'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'vi' ? 'Tốc độ TB' : 'Avg Speed'}</th>
                  <th className="py-3 px-6 text-right">{lang === 'vi' ? 'Tổng điểm' : 'Score'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leaderboard.map((row) => {
                  const domain =
                    COMPETENCY_DOMAINS.find((d) => d.id === row.topDomainId) ??
                    COMPETENCY_DOMAINS[0];
                  return (
                    <tr key={row.GroupID} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-6 font-mono-num font-bold text-slate-900">
                        #{row.Rank}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {row.GroupID}
                      </td>
                      <td className={`py-3.5 px-4 font-semibold ${domain.textClass}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>{row.SkillLevel}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-700">
                        {row.accuracyPercent}% ({row.correctCount}/{row.totalAnswered})
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-slate-700">
                        {(row.avgElapsedMs / 1000).toFixed(1)}s
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono-num font-bold text-sky-700">
                        {row.Score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Skill-Level Domain Champions */}
      {domainChampions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {lang === 'vi'
                  ? 'Đề xuất Danh hiệu Vinh danh Theo Từng Nhóm Kỹ Năng'
                  : 'Proposed Skill-Level Honor Titles by Competency Domain'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'vi'
                  ? 'EduBot phân tích điểm chính xác và tốc độ từng miền năng lực để đề xuất danh hiệu cho các nhóm xuất sắc.'
                  : 'EduBot evaluates per-domain accuracy and speed to award specialized digital citizen titles.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {domainChampions.map((award) => {
              const domain =
                COMPETENCY_DOMAINS.find((d) => d.id === award.domainId) ??
                COMPETENCY_DOMAINS[0];
              return (
                <div
                  key={`${award.domainId}-${award.groupId}`}
                  className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/40"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium truncate">
                      {domain.number}. {award.domainName}
                    </span>
                    <span className="font-mono-num font-bold text-slate-900 shrink-0">
                      {award.domainScore} {lang === 'vi' ? 'đ' : 'pts'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-sm font-bold ${domain.textClass}`}>
                    <Award className="w-4 h-4 shrink-0" />
                    <span>{award.honorTitle}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {award.groupId}
                  </p>
                  <p className="text-xs text-slate-600 tabular-nums">
                    {award.skillTierLabel} · {award.accuracyPercent}% ·{' '}
                    {(award.avgElapsedMs / 1000).toFixed(1)}s
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
