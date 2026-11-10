// =======================================================
// 🤖 Gemini API 공통 호출 모듈
// - 429(요청 제한)/5xx(서버 과부하)/네트워크 오류는 잠시 기다렸다 자동 재시도합니다.
// - 키 오류(400/401/403)는 재시도해도 소용없으므로 바로 알려줍니다.
// - 문제 출제와 AI 리포트가 이 함수 하나를 함께 사용합니다.
// =======================================================

import { Question } from '../types';

// 모델 호출 체인 (앞에서부터 시도)
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];
// 한 바퀴(모든 모델) 실패할 때마다 기다리는 시간(ms): 총 3번 재시도
const RETRY_DELAYS_MS = [2000, 4000, 8000];

export interface CallGeminiOptions {
  json?: boolean; // true면 JSON 응답 요청
  temperature?: number;
  onRetry?: (message: string) => void; // 재시도 안내를 화면에 보여주기 위한 콜백
  sleep?: (ms: number) => Promise<void>; // 테스트에서 대기 시간을 없애기 위한 주입용
}

// 일시적인 오류인지 판단 (undefined = 네트워크 오류)
const isRetryable = (status?: number): boolean =>
  status === undefined || status === 429 || status >= 500;

// 선생님이 이해하기 쉬운 오류 안내문
const friendlyMessage = (status: number | undefined, detail: string): string => {
  if (status === 400 || status === 401 || status === 403) {
    return `Gemini API 키를 확인해 주세요. 환경설정(⚙️)에서 키를 다시 입력하면 해결될 수 있어요. (${detail})`;
  }
  if (status === 429) {
    return `요청이 너무 많아 Gemini가 잠시 쉬고 있어요. 1분 뒤 다시 시도해 주세요. (${detail})`;
  }
  if (status !== undefined && status >= 500) {
    return `Gemini 서버가 지금 많이 바빠요. 잠시 후 다시 시도해 주세요. (${detail})`;
  }
  return `인터넷 연결을 확인해 주세요. (${detail})`;
};

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// 모델 하나를 호출해 { text } 또는 { status, detail } 반환
const callOnce = async (
  model: string,
  prompt: string,
  apiKey: string,
  opts: CallGeminiOptions
): Promise<{ text: string } | { status?: number; detail: string }> => {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        // 키를 주소(URL)가 아닌 헤더에 넣어 로그/주소창에 노출되지 않게 합니다.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            ...(opts.temperature !== undefined && { temperature: opts.temperature }),
            ...(opts.json && { responseMimeType: 'application/json' })
          }
        })
      }
    );
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { status: res.status, detail: errJson?.error?.message || res.statusText || `HTTP ${res.status}` };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    // 안전 필터 등으로 본문이 비면 서버 쪽 일시 문제처럼 재시도
    return text ? { text } : { status: 500, detail: '응답이 비어 있습니다' };
  } catch (e: any) {
    return { detail: e?.message || '네트워크 오류' };
  }
};

export const callGemini = async (
  prompt: string,
  apiKey: string,
  opts: CallGeminiOptions = {}
): Promise<string> => {
  const sleep = opts.sleep ?? defaultSleep;
  let last: { status?: number; detail: string } = { detail: '알 수 없는 오류' };

  for (let round = 0; round <= RETRY_DELAYS_MS.length; round++) {
    let retryableSeen = false;

    for (const model of MODELS) {
      const result = await callOnce(model, prompt, apiKey, opts);
      if ('text' in result) return result.text;

      last = result;
      console.warn(`Gemini [${model}] 실패 (${result.status ?? '네트워크'}): ${result.detail}`);

      if (result.status === 400 || result.status === 401 || result.status === 403) {
        throw new Error(friendlyMessage(result.status, result.detail)); // 키 문제: 재시도 무의미
      }
      if (isRetryable(result.status)) retryableSeen = true;
      // 404 등(모델 없음)은 다음 모델로 넘어갑니다.
    }

    if (!retryableSeen || round === RETRY_DELAYS_MS.length) break;

    const wait = RETRY_DELAYS_MS[round];
    opts.onRetry?.(`Gemini가 바빠서 ${wait / 1000}초 뒤 다시 시도합니다... (${round + 1}/${RETRY_DELAYS_MS.length})`);
    await sleep(wait);
  }

  throw new Error(friendlyMessage(last.status, last.detail));
};

// 🌟 견고한 다단계 JSON 파싱: 코드블록 제거 → 표준 파싱 → 정제 파싱 → 개별 객체 복구
export const parseQuestionsJson = (text: string): Question[] => {
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 가장 바깥쪽 대괄호 [ ... ] 영역만 슬라이스
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end > start) cleaned = cleaned.substring(start, end + 1);

  const tryParse = (s: string): any[] | null => {
    try {
      const res = JSON.parse(s);
      return Array.isArray(res) ? res : null;
    } catch {
      return null;
    }
  };

  // 후행 쉼표/제어문자 정제
  const sanitize = (s: string) =>
    // eslint-disable-next-line no-control-regex
    s.replace(/,\s*([\]}])/g, '$1').replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, '');

  const direct = tryParse(cleaned) ?? tryParse(sanitize(cleaned));
  if (direct) return direct;

  // 개별 문제 객체 { ... } 단위 복구
  const recovered = (cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [])
    .map(obj => { try { return JSON.parse(sanitize(obj)); } catch { return null; } })
    .filter(Boolean);
  if (recovered.length > 0) return recovered;

  throw new Error('생성된 문제의 형식이 올바르지 않습니다.');
};

