import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeAnswer, checkAnswer } from '../utils/mathAnswer';
import { generateStudentShareUrl } from '../utils/shareConfig';
import { getKoreanDateInfo } from '../services/analyticsService';
import { migrateClassData, deleteClass } from '../db';

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

describe('학급 데이터 이관 및 삭제 무결성 (migrateClassData & deleteClass)', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    (import.meta as any).env.VITE_FIREBASE_API_KEY = '';
    for (const key of Object.keys(store)) delete store[key];
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const key of Object.keys(store)) delete store[key]; }
    };
  });

  it('학급 이름 변경 시 종속 데이터의 classId와 복합 문서 ID를 함께 이관한다', async () => {
    store['mock_students'] = JSON.stringify([{ id: '1', classId: '1반', name: '홍길동' }]);
    store['mock_attendance'] = JSON.stringify([{ id: '2026-11-14_1반_1', date: '2026-11-14', classId: '1반', studentId: '1', status: 'present' }]);
    store['mock_submissions'] = JSON.stringify([
      { id: 'prob1_1반_1_1', date: '2026-11-14', classId: '1반', problemId: 'prob1', studentId: '1', questionId: 1, attempts: 1, history: [], isCompleted: true },
      { id: 'started_prob1_1반_1', date: '2026-11-14', classId: '1반', problemId: 'prob1', studentId: '1', questionId: 0, attempts: 0, history: [], isCompleted: false }
    ]);
    store['mock_comprehensive_reports'] = JSON.stringify([{ id: '1반_1', classId: '1반', studentId: '1', reportText: '리포트' }]);
    store['mock_online_status'] = JSON.stringify([{ id: '1반_1', classId: '1반', studentId: '1', lastActiveAt: '2026-11-14T00:00:00Z' }]);

    await migrateClassData('1반', '햇살반');

    const att = JSON.parse(store['mock_attendance']);
    expect(att[0].id).toBe('2026-11-14_햇살반_1');
    expect(att[0].classId).toBe('햇살반');

    const subs = JSON.parse(store['mock_submissions']);
    expect(subs[0].id).toBe('prob1_햇살반_1_1');
    expect(subs[1].id).toBe('started_prob1_햇살반_1');

    const reports = JSON.parse(store['mock_comprehensive_reports']);
    expect(reports[0].id).toBe('햇살반_1');
  });

  it('학급 삭제 시 해당 학급의 모든 고아 데이터를 함께 정리한다', async () => {
    store['mock_classes'] = JSON.stringify([{ id: '1반', name: '1반', createdAt: '2026-11-14' }]);
    store['mock_students'] = JSON.stringify([{ id: '1', classId: '1반', name: '홍길동' }]);
    store['mock_submissions'] = JSON.stringify([{ id: 'prob1_1반_1_1', classId: '1반', studentId: '1' }]);
    store['mock_problems'] = JSON.stringify([{ id: 'prob1', date: '2026-11-14', targetClasses: ['1반', '2반'], questions: [] }]);

    await deleteClass('1반');

    expect(JSON.parse(store['mock_classes'])).toHaveLength(0);
    expect(JSON.parse(store['mock_students'])).toHaveLength(0);
    expect(JSON.parse(store['mock_submissions'])).toHaveLength(0);
    expect(JSON.parse(store['mock_problems'])[0].targetClasses).toEqual(['2반']);
  });
});
