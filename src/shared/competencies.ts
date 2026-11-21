import { Competency, DomainInfo } from './types';

export const COMPETENCY_DOMAINS: DomainInfo[] = [
  {
    id: '1',
    number: 1,
    nameVi: 'Khai Thác Dữ Liệu',
    nameEn: 'Data & Information Literacy',
    accentHex: '#1D4ED8',
    surfaceClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    honorTitleVi: 'Thợ săn Tri thức Số',
    honorTitleEn: 'Digital Knowledge Hunter',
  },
  {
    id: '2',
    number: 2,
    nameVi: 'Giao Tiếp & Hợp Tác',
    nameEn: 'Communication & Collaboration',
    accentHex: '#0F766E',
    surfaceClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200',
    honorTitleVi: 'Chuyên gia Giao tiếp Số',
    honorTitleEn: 'Digital Communication Pro',
  },
  {
    id: '3',
    number: 3,
    nameVi: 'Sáng Tạo Nội Dung',
    nameEn: 'Digital Content Creation',
    accentHex: '#B45309',
    surfaceClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    honorTitleVi: 'Nhà Sáng tạo Nội dung Số',
    honorTitleEn: 'Digital Content Creator',
  },
  {
    id: '4',
    number: 4,
    nameVi: 'An Toàn',
    nameEn: 'Digital Safety',
    accentHex: '#BE123C',
    surfaceClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    honorTitleVi: 'Chiến thần Bảo mật dữ liệu',
    honorTitleEn: 'Data Security Guardian',
  },
  {
    id: '5',
    number: 5,
    nameVi: 'Giải Quyết Vấn Đề',
    nameEn: 'Problem Solving',
    accentHex: '#7C3AED',
    surfaceClass: 'bg-violet-50',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-200',
    honorTitleVi: 'Kỹ sư Giải quyết Vấn đề',
    honorTitleEn: 'Digital Problem Solver',
  },
  {
    id: '6',
    number: 6,
    nameVi: 'Ứng Dụng AI',
    nameEn: 'AI Literacy & Ethics',
    accentHex: '#4338CA',
    surfaceClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200',
    honorTitleVi: 'Bậc thầy Ứng dụng AI',
    honorTitleEn: 'Ethical AI Explorer',
  },
];

export const COMPETENCIES_24: Competency[] = [
  // 1. Khai Thác Dữ Liệu
  { id: '1.1', domainId: '1', nameVi: 'Tìm kiếm, lọc dữ liệu', nameEn: 'Searching & filtering data', isCoreHighlighted: false },
  { id: '1.2', domainId: '1', nameVi: 'Đánh giá thông tin', nameEn: 'Evaluating information', isCoreHighlighted: false },
  { id: '1.3', domainId: '1', nameVi: 'Quản lý, lưu trữ', nameEn: 'Managing & storing data', isCoreHighlighted: false },

  // 2. Giao Tiếp & Hợp Tác
  { id: '2.1', domainId: '2', nameVi: 'Tương tác số', nameEn: 'Digital interaction', isCoreHighlighted: false },
  { id: '2.2', domainId: '2', nameVi: 'Chia sẻ thông tin', nameEn: 'Sharing information', isCoreHighlighted: false },
  { id: '2.3', domainId: '2', nameVi: 'Trách nhiệm công dân số', nameEn: 'Digital citizenship responsibility', isCoreHighlighted: false },
  { id: '2.4', domainId: '2', nameVi: 'Hợp tác số', nameEn: 'Digital collaboration', isCoreHighlighted: false },
  { id: '2.5', domainId: '2', nameVi: 'Quy tắc ứng xử', nameEn: 'Netiquette & conduct', isCoreHighlighted: false },
  { id: '2.6', domainId: '2', nameVi: 'Quản lý danh tính', nameEn: 'Managing digital identity', isCoreHighlighted: false },

  // 3. Sáng Tạo Nội Dung
  { id: '3.1', domainId: '3', nameVi: 'Phát triển nội dung', nameEn: 'Developing digital content', isCoreHighlighted: false },
  { id: '3.2', domainId: '3', nameVi: 'Tích hợp và tạo lập lại', nameEn: 'Integrating & re-elaborating', isCoreHighlighted: false },
  { id: '3.3', domainId: '3', nameVi: 'Bản quyền và giấy phép', nameEn: 'Copyright & licenses', isCoreHighlighted: false },
  { id: '3.4', domainId: '3', nameVi: 'Lập trình', nameEn: 'Programming', isCoreHighlighted: false },

  // 4. An Toàn
  { id: '4.1', domainId: '4', nameVi: 'Bảo vệ thiết bị', nameEn: 'Protecting devices', isCoreHighlighted: false },
  { id: '4.2', domainId: '4', nameVi: 'Bảo vệ dữ liệu cá nhân', nameEn: 'Protecting personal data', isCoreHighlighted: false },
  { id: '4.3', domainId: '4', nameVi: 'Sức khỏe an sinh số', nameEn: 'Digital health & well-being', isCoreHighlighted: false },
  { id: '4.4', domainId: '4', nameVi: 'Bảo vệ môi trường', nameEn: 'Protecting the environment', isCoreHighlighted: false },

  // 5. Giải Quyết Vấn Đề
  { id: '5.1', domainId: '5', nameVi: 'Khắc phục sự cố', nameEn: 'Solving technical problems', isCoreHighlighted: false },
  { id: '5.2', domainId: '5', nameVi: 'Lựa chọn công cụ số', nameEn: 'Choosing digital tools', isCoreHighlighted: false },
  { id: '5.3', domainId: '5', nameVi: 'Sử dụng sáng tạo', nameEn: 'Creative use of technology', isCoreHighlighted: false },
  { id: '5.4', domainId: '5', nameVi: 'Cải thiện năng lực số', nameEn: 'Identifying competence gaps', isCoreHighlighted: false },

  // 6. Ứng Dụng AI
  { id: '6.1', domainId: '6', nameVi: 'Hiểu biết về AI', nameEn: 'Understanding AI', isCoreHighlighted: false },
  { id: '6.2', domainId: '6', nameVi: 'Sử dụng AI có đạo đức', nameEn: 'Ethical use of AI', isCoreHighlighted: false },
  { id: '6.3', domainId: '6', nameVi: 'Đánh giá công cụ AI', nameEn: 'Evaluating AI tools', isCoreHighlighted: false },
];

export function getCompetencyById(id: string): Competency {
  return (
    COMPETENCIES_24.find((c) => c.id === id) ??
    COMPETENCIES_24[0]
  );
}

export function getDomainByCompetencyId(competencyId: string): DomainInfo {
  const comp = getCompetencyById(competencyId);
  return (
    COMPETENCY_DOMAINS.find((d) => d.id === comp.domainId) ??
    COMPETENCY_DOMAINS[0]
  );
}
