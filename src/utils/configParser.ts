import { CustomFirebaseConfig } from '../config/appConfig';

/**
 * 🔍 Firebase 콘솔에서 복사한 자바스크립트 코드 뭉치 또는 JSON 텍스트에서
 * firebaseConfig 객체의 6개 필수 속성을 자동으로 추출하는 스마트 파서 함수입니다.
 * 
 * 지원 형식 예시:
 * const firebaseConfig = {
 *   apiKey: "AIzaSy...",
 *   authDomain: "my-app.firebaseapp.com",
 *   projectId: "my-app",
 *   storageBucket: "my-app.appspot.com",
 *   messagingSenderId: "123456789",
 *   appId: "1:123456:web:abcd"
 * };
 */
export const parseFirebaseConfigText = (rawInput: string): CustomFirebaseConfig | null => {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const text = rawInput.trim();

  // 1. 순수 JSON 파싱 시도
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.apiKey && parsed.projectId) {
      return {
        apiKey: String(parsed.apiKey || '').trim(),
        authDomain: String(parsed.authDomain || '').trim(),
        projectId: String(parsed.projectId || '').trim(),
        storageBucket: String(parsed.storageBucket || '').trim(),
        messagingSenderId: String(parsed.messagingSenderId || '').trim(),
        appId: String(parsed.appId || '').trim(),
      };
    }
  } catch {
    // JSON이 아니면 정규식 추출 진행
  }

  // 2. 정규식을 통한 키-값 추출
  const extractField = (key: string): string => {
    // 따옴표 종류 (' or " or `) 및 콜론(:), 등호(=) 패턴 매칭
    const regex = new RegExp(`['"]?${key}['"]?\\s*[:=]\\s*['"\`\\s]([^'"\`\\n,;]+)['"\`]`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const apiKey = extractField('apiKey');
  const authDomain = extractField('authDomain');
  const projectId = extractField('projectId');
  const storageBucket = extractField('storageBucket');
  const messagingSenderId = extractField('messagingSenderId');
  const appId = extractField('appId');

  // 최소한 apiKey와 projectId가 존재해야 유효한 설정으로 인정
  if (!apiKey || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
};

/**
 * 🔒 교사용 Firestore 기본 보안 규칙 추천 템플릿
 * 복사하여 Firebase 콘솔 > Firestore > 규칙에 붙여넣을 수 있도록 제공합니다.
 */
export const RECOMMENDED_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 📚 학생 및 교사 맞춤형 아침활동 데이터 읽기/쓰기 허용
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
