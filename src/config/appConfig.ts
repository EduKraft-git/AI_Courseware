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

// 환경변수(.env)에 유효한 Firebase 키가 존재하는지 확인하는 헬퍼
export const hasEnvFirebaseConfig = (): boolean => {
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
export const loadAppConfig = (): AppConfig => {
  const envFbConfig = getEnvFirebaseConfig();
  const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isEnvGeminiValid = !!envGeminiKey && envGeminiKey !== 'YOUR_GEMINI_API_KEY_HERE';

  // 로컬 스토리지에서 사용자 커스텀 설정 조회
  const rawSaved = localStorage.getItem(STORAGE_KEY);
  let savedConfig: Partial<AppConfig> = {};
  if (rawSaved) {
    try {
      savedConfig = JSON.parse(rawSaved);
    } catch (e) {
      console.error('설정 파싱 에러:', e);
    }
  }

  const geminiApiKey = (isEnvGeminiValid ? envGeminiKey : savedConfig.geminiApiKey) || '';
  const firebaseConfig = envFbConfig || savedConfig.firebaseConfig || null;
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  
  // 💡 정식 Firebase 설정 시 로컬에 남아있던 모든 임시 캐시를 완전히 제거하여 백지 상태 보장
  localStorage.removeItem('mock_classes');
  localStorage.removeItem('mock_students');
  localStorage.removeItem('mock_problems');
  localStorage.removeItem('mock_submissions');
  localStorage.removeItem('mock_attendance');
  localStorage.removeItem('mock_admin_logged');
};

// 모든 설정 완전 초기화 (로그아웃 및 키 삭제)
export const clearAppConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('mock_admin_logged');
  localStorage.removeItem('mock_classes');
  localStorage.removeItem('mock_students');
  localStorage.removeItem('mock_problems');
  localStorage.removeItem('mock_submissions');
  localStorage.removeItem('mock_attendance');
  localStorage.removeItem('temp_gemini_api_key');
};

// 현재 유효한 Gemini API 키 반환
export const getActiveGeminiApiKey = (): string => {
  const config = loadAppConfig();
  return config.geminiApiKey || localStorage.getItem('temp_gemini_api_key') || '';
};
