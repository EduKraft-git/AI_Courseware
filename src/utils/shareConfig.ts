// =======================================================
// 🔗 학생 접속용 공유 URL 생성 및 파싱 유틸리티
// 교사가 설정한 Firebase와 Gemini API 정보를 URL 파라미터로 압축 인코딩하여,
// 학생들이 QR코드를 스캔하는 즉시 교사의 학급 DB로 연결되도록 지원합니다.
// =======================================================

import { AppConfig, CustomFirebaseConfig } from '../config/appConfig';

// 1. 교사의 설정을 압축 인코딩하여 학생용 공유 URL 생성
export const generateStudentShareUrl = (config: AppConfig): string => {
  if (!config.firebaseConfig || !config.firebaseConfig.apiKey) {
    // 설정이 없는 경우 기본 origin 반환
    return window.location.origin + window.location.pathname;
  }

  // 데이터 크기를 최소화하기 위해 키 이름을 한 글자로 단축
  const payload = {
    a: config.firebaseConfig.apiKey,
    d: config.firebaseConfig.authDomain,
    p: config.firebaseConfig.projectId,
    b: config.firebaseConfig.storageBucket,
    m: config.firebaseConfig.messagingSenderId,
    i: config.firebaseConfig.appId,
    g: config.geminiApiKey || ''
  };

  try {
    const jsonStr = JSON.stringify(payload);
    // 한글이나 특수문자 대응을 위한 안전한 Base64 인코딩
    const encoded = btoa(encodeURIComponent(jsonStr));
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('c', encoded);
    return url.toString();
  } catch (err) {
    console.error('공유 URL 생성 실패:', err);
    return window.location.origin + window.location.pathname;
  }
};

// 2. 학생이 접속한 URL에서 교사의 설정 정보 파싱
export const parseStudentShareUrl = (): { firebaseConfig: CustomFirebaseConfig; geminiApiKey: string } | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    let raw = params.get('c');

    // 혹시 hash(#c=...) 형태로 전달된 경우 보완
    if (!raw && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      raw = hashParams.get('c');
    }

    if (!raw) return null;

    const decoded = decodeURIComponent(atob(raw));
    const data = JSON.parse(decoded);

    if (data.a && data.p) {
      return {
        firebaseConfig: {
          apiKey: data.a,
          authDomain: data.d || '',
          projectId: data.p,
          storageBucket: data.b || '',
          messagingSenderId: data.m || '',
          appId: data.i || ''
        },
        geminiApiKey: data.g || ''
      };
    }
  } catch (err) {
    console.error('URL 설정 파싱 오류:', err);
  }

  return null;
};
