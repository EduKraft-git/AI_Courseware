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

// AI가 생성할 수 있는 다양한 분수 표기(LaTeX \frac, '1과 1/2', '4분의 3', '3 / 4' 등)를 표준 '1 1/2', '3/4' 형태로 통일
export const normalizeFractionText = (text: string): string => {
  if (!text) return '';
  return text
    // 1. LaTeX 대분수 및 일반 분수 변환 (예: 1\frac{1}{2} -> 1 1/2, \frac{3}{4} -> 3/4)
    .replace(/(\d+)\s*\\(?:d|t)?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, '$1 $2/$3')
    .replace(/\\(?:d|t)?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, '$1/$2')
    .replace(/\\div\b/g, '÷')
    .replace(/\\times\b/g, '×')
    // 수식 주변에 남은 불필요한 $ 기호 제거 (예: $3/4 ÷ 1/2$ -> 3/4 ÷ 1/2)
    .replace(/\$([^$]+)\$/g, '$1')
    // 2. 한글 분수 표기 변환 (예: 1과 2분의 1 -> 1 1/2, 4분의 3 -> 3/4)
    .replace(/(?<![/⁄／\d])(\d+)\s*(?:과|와)\s*(\d+)\s*분의\s*(\d+)/g, '$1 $3/$2')
    .replace(/(?<![/⁄／\d])(\d+)\s*분의\s*(\d+)/g, '$2/$1')
    // 3. 한글 대분수 + 슬래시 표기 변환 (예: 1과 1/2, 2와 3/4 -> 1 1/2, 2 3/4, 단 1/2과 3/4에서 분모 2는 제외)
    .replace(/(?<![/⁄／\d])(\d+)\s*(?:과|와)\s*(\d+)\s*[/⁄／]\s*(\d+)/g, '$1 $2/$3')
    // 4. 특수 슬래시 및 슬래시 앞뒤 공백 정리 (단, 2026/11/14 같은 날짜는 제외)
    .replace(/(?<![/⁄／\d])(\d+)\s*[/⁄／]\s*(\d+)(?![/⁄／\d])/g, '$1/$2');
};

// 정답 중 하나라도 분수(a/b)가 있으면 분수 입력칸을 사용
export const isFractionAnswer = (answers: string[]): boolean =>
  answers.some(a => /\d+\/\d+/.test(normalizeFractionText(String(a))));

// "1 1/2" → {1, 1, 2}, "3/4" → {'', 3, 4}, "2" → {2, '', ''}, "11/2" → {'', 11, 2}
export const parseFraction = (value: string): FractionParts => {
  const normalized = normalizeFractionText(value).trim();
  const m = normalized.match(/^(?:(\d+)(?:\s+|$))?(?:(\d+)\/(\d+))?$/);
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

// 대분수(1 1/2) 또는 분수(3/4) (날짜 등 연속 슬래시는 제외)
const FRACTION_RE = /(?<![/\d])(?:(\d+)\s+)?(\d+)\/(\d+)(?![/\d])/g;

// 글 속에서 분수만 골라내 [글자, 분수, 글자, ...] 로 나눕니다.
export const splitFractions = (text: string): MathPart[] => {
  const normalized = normalizeFractionText(text);
  const parts: MathPart[] = [];
  let last = 0;
  for (const m of normalized.matchAll(FRACTION_RE)) {
    if (m.index > last) parts.push(normalized.slice(last, m.index));
    parts.push({ whole: m[1] ?? '', num: m[2], den: m[3] });
    last = m.index + m[0].length;
  }
  if (last < normalized.length) parts.push(normalized.slice(last));
  return parts;
};
