// =======================================================
// ⚙️ 앱 전역 설정 관리자 (App Configuration Manager)
// 사용자가 입력한 Gemini API 키, Firebase 설정, 데모 모드 상태를 로컬에 보관합니다.
// =======================================================

export interface CustomFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AppConfig {
  geminiApiKey: string;
  firebaseConfig: CustomFirebaseConfig | null;
  adminEmail: string;
  isConfigured: boolean; // 사용자가 정식 설정을 완료했는지 여부
  configuredAt?: string;
}

const STORAGE_KEY = 'ai_courseware_app_config';

// 환경변수(.env)에 유효한 Firebase 키가 존재하는지 확인하는 헬퍼 (단위 테스트 환경에서는 실제 클라우드 DB 오작동 방지를 위해 제외)
export const hasEnvFirebaseConfig = (): boolean => {
  if (import.meta.env.MODE === 'test') return false;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  return !!apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY_HERE';
};

// 환경변수(.env)에서 Firebase 설정을 가져오는 함수
export const getEnvFirebaseConfig = (): CustomFirebaseConfig | null => {
  if (!hasEnvFirebaseConfig()) return null;
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };
};

// 환경변수 또는 로컬 스토리지에서 전체 설정 로드
// 브라우저 및 비브라우저(테스트/SSR) 환경 안전 가드
const safeGetItem = (key: string): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
};

const safeSetItem = (key: string, value: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
};

const safeRemoveItem = (key: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
};

export const loadAppConfig = (): AppConfig => {
  const envFbConfig = getEnvFirebaseConfig();
  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isEnvGeminiValid = !!envGeminiKey && envGeminiKey !== 'YOUR_GEMINI_API_KEY_HERE';

  // 로컬 스토리지에서 사용자 커스텀 설정 조회
  const rawSaved = safeGetItem(STORAGE_KEY);
  let savedConfig: Partial<AppConfig> = {};
  if (rawSaved) {
    try {
      savedConfig = JSON.parse(rawSaved);
    } catch (e) {
      console.error('설정 파싱 에러:', e);
    }
  }

  const geminiApiKey = savedConfig.geminiApiKey || (isEnvGeminiValid ? envGeminiKey : '') || '';
  const firebaseConfig = savedConfig.firebaseConfig || envFbConfig || null;
  const isConfigured = !!(geminiApiKey && firebaseConfig && firebaseConfig.apiKey);

  return {
    geminiApiKey,
    firebaseConfig,
    adminEmail: savedConfig.adminEmail || '',
    isConfigured,
    configuredAt: savedConfig.configuredAt,
  };
};

// 사용자 커스텀 설정 저장
export const saveAppConfig = (
  geminiApiKey: string,
  firebaseConfig: CustomFirebaseConfig,
  adminEmail: string = ''
): void => {
  const config: AppConfig = {
    geminiApiKey: geminiApiKey.trim(),
    firebaseConfig,
    adminEmail: adminEmail.trim(),
    isConfigured: true,
    configuredAt: new Date().toISOString(),
  };

  safeSetItem(STORAGE_KEY, JSON.stringify(config));
  
  // 💡 정식 Firebase 설정 시 로컬에 남아있던 모든 임시 캐시를 완전히 제거하여 백지 상태 보장
  safeRemoveItem('mock_classes');
  safeRemoveItem('mock_students');
  safeRemoveItem('mock_problems');
  safeRemoveItem('mock_submissions');
  safeRemoveItem('mock_attendance');
  safeRemoveItem('mock_admin_logged');
};

// 모든 설정 완전 초기화 (로그아웃 및 키 삭제)
export const clearAppConfig = (): void => {
  safeRemoveItem(STORAGE_KEY);
  safeRemoveItem('mock_admin_logged');
  safeRemoveItem('mock_classes');
  safeRemoveItem('mock_students');
  safeRemoveItem('mock_problems');
  safeRemoveItem('mock_submissions');
  safeRemoveItem('mock_attendance');
  safeRemoveItem('temp_gemini_api_key');
};

// 현재 유효한 Gemini API 키 반환
export const getActiveGeminiApiKey = (): string => {
  const config = loadAppConfig();
  return config.geminiApiKey || safeGetItem('temp_gemini_api_key') || '';
};
