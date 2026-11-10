import { describe, it, expect } from 'vitest';
import { normalizeAnswer, checkAnswer } from '../utils/mathAnswer';
import { generateStudentShareUrl } from '../utils/shareConfig';
import { getKoreanDateInfo } from '../services/analyticsService';

describe('수학 답안 채점 정규화 (mathAnswer)', () => {
  it('정수 및 소수를 올바르게 정규화한다', () => {
    expect(normalizeAnswer(' 42 ')).toBe('42');
    expect(normalizeAnswer(' 3.14 ')).toBe('3.14');
    expect(normalizeAnswer(' 1,000 ')).toBe('1000');
  });

  it('대분수와 가분수를 구분하여 보존한다', () => {
    expect(normalizeAnswer('1 1/2')).toBe('1 1/2');
    expect(normalizeAnswer('1   1/2')).toBe('1 1/2');
    expect(normalizeAnswer('11/2')).toBe('11/2');
    expect(normalizeAnswer('1 1/2')).not.toBe(normalizeAnswer('11/2'));
  });

  it('분수 슬래시 앞뒤 공백을 정돈한다', () => {
    expect(normalizeAnswer('1 / 2')).toBe('1/2');
    expect(normalizeAnswer('1  1 / 2')).toBe('1 1/2');
  });

  it('다양한 정답 후보군과 학생 답안을 공정하게 대조한다', () => {
    const answers = ['1 1/2', '1.5', '3/2'];
    expect(checkAnswer('1 1/2', answers)).toBe(true);
    expect(checkAnswer('1  1 / 2', answers)).toBe(true);
    expect(checkAnswer('1.5', answers)).toBe(true);
    expect(checkAnswer('3/2', answers)).toBe(true);
    expect(checkAnswer('11/2', answers)).toBe(false); // 가분수 11/2는 오답 처리
  });
});

describe('학생용 공유 설정 유틸리티 (shareConfig)', () => {
  it('학생 공유 URL 생성 시 교사의 geminiApiKey를 노출하지 않는다', () => {
    const mockConfig: any = {
      firebaseConfig: {
        apiKey: 'fake-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '12345',
        appId: '1:12345:web:abc'
      },
      geminiApiKey: 'SECRET_GEMINI_API_KEY_DO_NOT_LEAK',
      adminEmail: 'teacher@school.kr',
      isConfigured: true
    };

    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = {
        location: { origin: 'https://myschool.vercel.app', pathname: '/' }
      };
    }

    const shareUrl = generateStudentShareUrl(mockConfig);
    const urlObj = new URL(shareUrl);
    const encoded = urlObj.searchParams.get('c');
    expect(encoded).toBeTruthy();

    const decoded = JSON.parse(decodeURIComponent(atob(encoded!)));
    expect(decoded.a).toBe('fake-api-key');
    expect(decoded.p).toBe('test-project');
    expect(decoded.g).toBeUndefined(); // geminiApiKey(g)는 절대로 학생 URL payload에 포함되지 않아야 함
  });
});

describe('한국 표준시 날짜 계산 (getKoreanDateInfo)', () => {
  it('YYYY-MM-DD 포맷과 0~23 시(Hour) 정수 문자열을 반환한다', () => {
    const { dateStr, hourStr } = getKoreanDateInfo();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const hourNum = parseInt(hourStr, 10);
    expect(hourNum).toBeGreaterThanOrEqual(0);
    expect(hourNum).toBeLessThanOrEqual(23);
  });
});
