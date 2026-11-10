import { describe, it, expect, vi, afterEach } from 'vitest';
import { callGemini, parseQuestionsJson } from '../services/gemini';

const okResponse = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const errResponse = (status: number, message = 'err') =>
  new Response(JSON.stringify({ error: { message } }), { status });

const noSleep = () => Promise.resolve();

afterEach(() => vi.restoreAllMocks());

describe('callGemini 자동 재시도', () => {
  it('서버가 바쁠 때(503) 재시도해서 성공하면 결과를 돌려준다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(errResponse(503)) // 3.8 모델 실패
      .mockResolvedValueOnce(errResponse(503)) // 3.6 모델 실패
      .mockResolvedValueOnce(okResponse('성공')); // 재시도 1회차 성공
    const onRetry = vi.fn();

    const text = await callGemini('p', 'key', { sleep: noSleep, onRetry });

    expect(text).toBe('성공');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('API 키 오류(403)는 재시도하지 않고 바로 안내한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(errResponse(403, 'API key not valid'));

    await expect(callGemini('p', 'bad', { sleep: noSleep })).rejects.toThrow('API 키를 확인');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('계속 429이면 정해진 횟수(4바퀴 x 2모델)만 시도하고 안내문과 함께 실패한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => errResponse(429));

    await expect(callGemini('p', 'key', { sleep: noSleep })).rejects.toThrow('1분 뒤 다시');
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('첫 모델이 없으면(404) 다음 모델로 넘어가 성공한다', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(errResponse(404))
      .mockResolvedValueOnce(okResponse('두번째 모델'));

    expect(await callGemini('p', 'key', { sleep: noSleep })).toBe('두번째 모델');
  });

  it('API 키를 주소(URL)가 아닌 헤더로 보낸다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse('ok'));

    await callGemini('p', 'SECRET', { sleep: noSleep });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('SECRET');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'SECRET' });
  });
});

describe('parseQuestionsJson', () => {
  it('코드블록과 후행 쉼표가 있어도 파싱한다', () => {
    const raw = '```json\n[{"id":1,"questionText":"a",},{"id":2,"questionText":"b"},]\n```';
    expect(parseQuestionsJson(raw)).toHaveLength(2);
  });

  it('중간이 깨져도 온전한 문제 객체만 복구한다', () => {
    const raw = '[{"id":1,"questionText":"a"},{"id":2,"questionText":"b"';
    expect(parseQuestionsJson(raw)).toHaveLength(1);
  });

  it('JSON이 전혀 아니면 오류를 던진다', () => {
    expect(() => parseQuestionsJson('죄송합니다 만들 수 없어요')).toThrow('형식이 올바르지 않습니다');
  });
});

