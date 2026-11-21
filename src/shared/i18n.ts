import { Language, UiMode } from './types';

export interface CopyDict {
  brandName: string;
  navIdentity: string;
  navPlay: string;
  navHonor: string;
  navTeacher: string;
  step1Title: string;
  step1Subtitle: string;
  classCodeLabel: string;
  tabletSelectLabel: string;
  groupNameLabel: string;
  groupNamePlaceholder: string;
  startMissionBtn: string;
  switchShiftBtn: string;
  kidModeLabel: string;
  standardModeLabel: string;
  offlineReadyLabel: string;
  offlineSimulatedLabel: string;
  pendingSyncLabel: string;
  syncNowBtn: string;
  notificationsTitle: string;
  enablePushBtn: string;
  newAssignmentBanner: string;
  aiHintTitle: string;
  aiHintHelp: string;
  copyKeywordBtn: string;
  copiedLabel: string;
  submitAnswerBtn: string;
  finishLeaderboardBtn: string;
  nextQuestionBtn: string;
  leaderboardTitle: string;
  honorBoardTitle: string;
  teacherTitle: string;
  uploadLessonTitle: string;
  generateQuizBtn: string;
  competencyMatrixTitle: string;
  activityHistoryTitle: string;
}

export function getCopy(lang: Language, mode: UiMode): CopyDict {
  if (lang === 'en') {
    return {
      brandName: 'EduBot Digital Citizen',
      navIdentity: 'Check-In',
      navPlay: 'Play Quiz',
      navHonor: 'Honor Board',
      navTeacher: 'Teacher Studio',
      step1Title: mode === 'kid' ? 'Pick Your Class & Tablet!' : 'Step 1 · Tablet & Group Check-In',
      step1Subtitle:
        mode === 'kid'
          ? 'Choose your classroom code and tap your tablet number (01–10) before starting.'
          : 'Verify your Class ID and shared Tablet / Group before starting to keep scores accurate across shifts.',
      classCodeLabel: 'Class Code (Mã Lớp)',
      tabletSelectLabel: 'Shared Tablet Number (01–10)',
      groupNameLabel: 'Team / Group Name',
      groupNamePlaceholder: 'e.g. Blue Stars',
      startMissionBtn: mode === 'kid' ? 'Let’s Play!' : 'Confirm Session & Continue',
      switchShiftBtn: 'Switch Shift / Group',
      kidModeLabel: 'Kid-Friendly Icons',
      standardModeLabel: 'Minimal Standard',
      offlineReadyLabel: 'Online · Auto-Sync Active',
      offlineSimulatedLabel: 'Offline Queue Mode',
      pendingSyncLabel: 'pending sync',
      syncNowBtn: 'Sync Now',
      notificationsTitle: 'New Lesson Alerts',
      enablePushBtn: 'Enable Push Alerts',
      newAssignmentBanner: 'New Mission Assigned!',
      aiHintTitle: 'AI / Search Keyword Hint',
      aiHintHelp: 'Search this keyword on AI or Google before choosing your final answer!',
      copyKeywordBtn: 'Copy Keyword',
      copiedLabel: 'Copied!',
      submitAnswerBtn: mode === 'kid' ? 'Send My Answer!' : 'Submit Answer',
      finishLeaderboardBtn: 'Finish & View Honor Board',
      nextQuestionBtn: 'Next Question',
      leaderboardTitle: 'Class Leaderboard',
      honorBoardTitle: 'Skill-Level Honor Board',
      teacherTitle: 'Teacher Control Center',
      uploadLessonTitle: 'Upload Lesson & Generate 24-Competency Quiz',
      generateQuizBtn: 'Generate Questions with AI',
      competencyMatrixTitle: 'Digital Competence Framework (TT 02/2025)',
      activityHistoryTitle: 'Tablet Activity History',
    };
  }

  return {
    brandName: 'EduBot Công Dân Số',
    navIdentity: 'Vào lớp',
    navPlay: 'Trò chơi',
    navHonor: 'Vinh danh',
    navTeacher: 'Giáo viên',
    step1Title:
      mode === 'kid'
        ? 'Chào bạn nhỏ! Chọn Lớp & Số Máy nhé'
        : 'Bước 1 · Định danh Lớp học & Máy tính bảng',
    step1Subtitle:
      mode === 'kid'
        ? 'Nhấn chọn Mã lớp và số thứ tự Máy tính bảng (01–10) của nhóm mình để không bị nhầm điểm với tiết trước.'
        : 'Hệ thống kiểm tra Mã Lớp và Tên Nhóm/Số Máy (01–10) trước mỗi lượt chơi để tách biệt điểm số khi đổi ca học.',
    classCodeLabel: 'Mã Lớp Học',
    tabletSelectLabel: 'Chọn Máy Tính Bảng (01 – 10)',
    groupNameLabel: 'Tên Nhóm của em',
    groupNamePlaceholder: 'Ví dụ: Nhóm Sao Xanh',
    startMissionBtn: mode === 'kid' ? 'Vào chơi ngay!' : 'Xác nhận phiên làm việc',
    switchShiftBtn: 'Đổi ca / Đổi nhóm',
    kidModeLabel: 'Trực quan (Học sinh nhỏ)',
    standardModeLabel: 'Tối giản tiêu chuẩn',
    offlineReadyLabel: 'Trực tuyến · Đồng bộ tự động',
    offlineSimulatedLabel: 'Ngoại tuyến · Đang lưu đệm',
    pendingSyncLabel: 'chờ đồng bộ',
    syncNowBtn: 'Đồng bộ ngay',
    notificationsTitle: 'Thông báo bài tập mới',
    enablePushBtn: 'Bật thông báo đẩy',
    newAssignmentBanner: 'Cô/Thầy vừa giao bài học mới!',
    aiHintTitle: 'Gợi ý từ khóa tìm kiếm trên AI / Google',
    aiHintHelp: 'Các em hãy dùng từ khóa này để tra cứu AI hoặc tìm kiếm trước khi chốt đáp án nhé!',
    copyKeywordBtn: 'Sao chép từ khóa',
    copiedLabel: 'Đã sao chép!',
    submitAnswerBtn: mode === 'kid' ? 'Gửi đáp án của nhóm!' : 'Chốt đáp án',
    finishLeaderboardBtn: 'Kết thúc & Xem bảng xếp hạng',
    nextQuestionBtn: 'Câu hỏi tiếp theo',
    leaderboardTitle: 'Bảng Xếp Hạng Nhóm',
    honorBoardTitle: 'Bảng Vinh Danh Theo Cấp Độ Kỹ Năng',
    teacherTitle: 'Trung Tâm Quản Lý Giáo Viên',
    uploadLessonTitle: 'Tải Tài Liệu Bài Học & Tạo Câu Hỏi AI',
    generateQuizBtn: 'Tạo bộ câu hỏi Công dân số',
    competencyMatrixTitle: 'Khung Năng Lực Số (TT 02/2025)',
    activityHistoryTitle: 'Lịch Sử Hoạt Động Theo Lớp & Máy',
  };
}
