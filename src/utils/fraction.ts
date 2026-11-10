// =======================================================
// 🔢 분수 표시/입력용 순수 함수 모음
// DB와 채점은 기존처럼 "3/4", "1 1/2" 같은 글자를 그대로 쓰고,
// 화면에서만 위아래로 쌓인 분수 모양으로 보여주고 입력받습니다.
// =======================================================

export interface FractionParts {
  whole: string; // 자연수 (대분수일 때만)
  num: string; // 분자
  den: string; // 분모
}

export type MathPart = string | { whole: string; num: string; den: string };

// 정답 중 하나라도 분수(a/b)가 있으면 분수 입력칸을 사용
export const isFractionAnswer = (answers: string[]): boolean =>
  answers.some(a => /\d\s*\/\s*\d/.test(a));

// "1 1/2" → {1, 1, 2}, "3/4" → {'', 3, 4}, "2" → {2, '', ''}, "11/2" → {'', 11, 2}
export const parseFraction = (value: string): FractionParts => {
  const m = value.trim().replace(/\s*\/\s*/g, '/').match(/^(?:(\d+)(?:\s+|$))?(?:(\d+)\/(\d+))?$/);
  return { whole: m?.[1] ?? '', num: m?.[2] ?? '', den: m?.[3] ?? '' };
};

// {1, 1, 2} → "1 1/2". 분자/분모 중 하나만 채워졌으면 미완성이므로 '' (제출 불가)
export const composeFraction = ({ whole, num, den }: FractionParts): string => {
  const w = whole.trim();
  const n = num.trim();
  const d = den.trim();
  if (!n !== !d) return '';
  return [w, n && `${n}/${d}`].filter(Boolean).join(' ');
};

// 대분수(1 1/2) 또는 분수(3/4)
const FRACTION_RE = /(?:(\d+)\s+)?(\d+)\/(\d+)/g;

// 글 속에서 분수만 골라내 [글자, 분수, 글자, ...] 로 나눕니다.
export const splitFractions = (text: string): MathPart[] => {
  const parts: MathPart[] = [];
  let last = 0;
  for (const m of text.matchAll(FRACTION_RE)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ whole: m[1] ?? '', num: m[2], den: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

