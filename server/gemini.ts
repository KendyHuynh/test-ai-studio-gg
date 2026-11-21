import { GoogleGenAI, Type } from '@google/genai';
import { COMPETENCIES_24 } from '../src/shared/competencies';
import { Language, Question } from '../src/shared/types';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeneratedLessonPayload {
  title: string;
  topic: string;
  summary: string;
  questions: Question[];
}

export async function generateLessonQuestions(params: {
  title?: string;
  sourceFileName: string;
  textContent?: string;
  base64Data?: string;
  mimeType?: string;
  questionCount: number;
  language: Language;
}): Promise<GeneratedLessonPayload> {
  const ai = getGeminiClient();
  const competencyCatalog = COMPETENCIES_24.map(
    (c) => `${c.id}: ${params.language === 'vi' ? c.nameVi : c.nameEn}`,
  ).join('\n');

  const count = Math.max(3, Math.min(params.questionCount || 15, 25));
  const langLabel = params.language === 'vi' ? 'Tiếng Việt' : 'English';

  const systemInstruction = `Bạn là "EduBot Digital Citizen" - Trợ lý AI giáo dục chuyên về khung 24 Năng lực Công dân số (TT 02/2025).
Nhiệm vụ của bạn: Đọc kỹ nội dung bài học giáo viên cung cấp và tạo ra ĐÚNG ${count} câu hỏi trò chơi tương tác (không ít hơn ${count} câu, tương tự Quizizz/Kahoot) bằng ${langLabel}, phù hợp với học sinh phổ thông.

QUY TẮC BẮT BUỘC:
1. Mỗi câu hỏi phải ánh xạ vào 1 hoặc nhiều mã năng lực thành phần (1 đến 2 mã phù hợp nhất) trong số 24 mã dưới đây (chỉ ghi mã số như "1.1", "4.2", "6.2"):
${competencyCatalog}
2. Kết hợp đa dạng dạng câu hỏi: "multiple_choice" (có đúng 4 đáp án ngắn gọn rõ ràng trong options, và correctAnswer trùng khớp hoàn toàn với 1 phần tử trong options), "fill_blank" (1 chỗ trống ______ với đáp án ngắn 1-3 từ), và "short_answer" kích thích tư duy.
3. Mỗi câu hỏi PHẢI có "aiSearchKeywordHint": gợi ý từ khóa cụ thể để học sinh tự đi tra cứu trên Google hoặc AI khác trước khi chọn đáp án cuối cùng.
4. Mỗi câu hỏi PHẢI có "explanation": giải thích ngắn gọn, dễ hiểu, gắn với tiêu chuẩn Công dân số.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (params.base64Data && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.base64Data,
      },
    });
  }

  const promptText = `Tài liệu bài học: "${params.sourceFileName}"
Tiêu đề gợi ý: "${params.title || params.sourceFileName}"
${params.textContent ? `\nNội dung bài học:\n${params.textContent.slice(0, 24000)}` : '\nHãy phân tích tệp đính kèm ở trên và tạo câu hỏi.'}

Hãy trích xuất chủ đề chính, viết tóm tắt 1-2 câu và tạo ${count} câu hỏi Công dân số theo đúng JSON schema.`;

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          topic: { type: Type.STRING },
          summary: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: ['multiple_choice', 'fill_blank', 'short_answer'],
                },
                questionText: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                aiSearchKeywordHint: { type: Type.STRING },
                correctAnswer: { type: Type.STRING },
                competencyIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                explanation: { type: Type.STRING },
              },
              required: [
                'type',
                'questionText',
                'aiSearchKeywordHint',
                'correctAnswer',
                'competencyIds',
                'explanation',
              ],
            },
          },
        },
        required: ['title', 'topic', 'summary', 'questions'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    title: string;
    topic: string;
    summary: string;
    questions: Array<Omit<Question, 'id' | 'competencyId'> & { competencyId?: string }>;
  };

  const validIds = new Set(COMPETENCIES_24.map((c) => c.id));
  const questions: Question[] = (parsed.questions ?? []).map((q, index) => {
    const rawList = q.competencyIds?.length
      ? q.competencyIds
      : q.competencyId
        ? [q.competencyId]
        : ['1.1'];
    const filteredIds = Array.from(new Set(rawList.filter((id) => validIds.has(id))));
    const safeCompIds = filteredIds.length > 0 ? filteredIds : ['1.1'];
    const safeType =
      q.type === 'fill_blank' || q.type === 'short_answer'
        ? q.type
        : 'multiple_choice';
    const options =
      safeType === 'multiple_choice'
        ? (q.options && q.options.length >= 2 ? q.options : [q.correctAnswer ?? 'Đúng', 'Sai'])
        : undefined;

    return {
      id: `q-${Date.now()}-${index + 1}`,
      type: safeType,
      questionText: q.questionText,
      options,
      aiSearchKeywordHint: q.aiSearchKeywordHint,
      correctAnswer: q.correctAnswer,
      competencyId: safeCompIds[0],
      competencyIds: safeCompIds,
      explanation: q.explanation,
    };
  });

  return {
    title: params.title?.trim() || parsed.title || params.sourceFileName,
    topic: parsed.topic || 'Công dân số (TT 02/2025)',
    summary: parsed.summary || '',
    questions,
  };
}

export async function evaluateShortAnswerWithAI(params: {
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  competencyName: string;
  groupName: string;
  language: Language;
}): Promise<{ isCorrect: boolean; feedbackText: string; explanation: string }> {
  const ai = getGeminiClient();
  const langLabel = params.language === 'vi' ? 'Tiếng Việt' : 'English';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Câu hỏi: ${params.questionText}
Đáp án chuẩn tham chiếu: ${params.correctAnswer}
Câu trả lời của nhóm "${params.groupName}": ${params.userAnswer}
Năng lực công dân số: ${params.competencyName}

Hãy chấm xem câu trả lời của học sinh có đúng/chấp nhận được về mặt ý nghĩa Công dân số không, và viết lời nhận xét giọng MC trò chơi vui tươi, cổ vũ bằng ${langLabel} (tối đa 2 câu) kèm giải thích ngắn gọn (1-2 câu).`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          feedbackText: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['isCorrect', 'feedbackText', 'explanation'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    isCorrect: boolean;
    feedbackText: string;
    explanation: string;
  };
  return parsed;
}
