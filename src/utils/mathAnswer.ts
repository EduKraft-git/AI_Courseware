// 수학 답안 정규화 및 채점 유틸리티
// 대분수(예: 1 1/2)와 가분수(예: 11/2)를 명확히 구분하면서,
// 불필요한 슬래시 공백 및 다중 공백을 정돈하여 공정한 채점을 보장합니다.

export const normalizeAnswer = (str: string): string => {
  return str
    .trim()
    .replace(/,/g, '') // 쉼표 제거 (예: 1,000 -> 1000)
    .replace(/\s*\/\s*/g, '/') // 분수 슬래시 앞뒤 공백 제거 (예: "1 / 2" -> "1/2")
    .replace(/\s+/g, ' ') // 대분수 자연수와 분수 사이 공백은 1칸으로 보존 (예: "1   1/2" -> "1 1/2")
    .toLowerCase();
};

export const checkAnswer = (studentInput: string, answers: string[]): boolean => {
  if (!studentInput || !answers || answers.length === 0) return false;
  const cleanedInput = normalizeAnswer(studentInput);
  return answers.some(ans => normalizeAnswer(ans) === cleanedInput);
};

