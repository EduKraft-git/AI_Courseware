import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { CustomFirebaseConfig, loadAppConfig } from '../config/appConfig';

let currentApp: FirebaseApp | null = null;
let currentAuth: Auth | null = null;
let currentDb: Firestore | null = null;

// Firebase 인스턴스를 초기화하거나 기존 인스턴스를 갱신하는 함수
export const initFirebaseWithConfig = (config: CustomFirebaseConfig): { app: FirebaseApp; auth: Auth; db: Firestore } => {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      // 기존 앱이 있으면 가져오거나 재초기화
      currentApp = getApp();
    } else {
      currentApp = initializeApp(config);
    }
  } catch {
    // 앱 이름 충돌 등의 경우 기본 앱 획득
    currentApp = initializeApp(config, `app_${Date.now()}`);
  }

  currentAuth = getAuth(currentApp);
  currentDb = getFirestore(currentApp);

  return { app: currentApp, auth: currentAuth, db: currentDb };
};

// 현재 유효한 Firebase 인스턴스 획득 (없으면 로컬 설정으로 초기화 시도)
export const getActiveFirebase = (): { auth: Auth | null; db: Firestore | null } => {
  if (currentAuth && currentDb) {
    return { auth: currentAuth, db: currentDb };
  }

  const appConfig = loadAppConfig();
  if (appConfig.firebaseConfig && appConfig.firebaseConfig.apiKey) {
    try {
      const { auth, db } = initFirebaseWithConfig(appConfig.firebaseConfig);
      return { auth, db };
    } catch (e) {
      console.error('동적 Firebase 초기화 실패:', e);
    }
  }

  return { auth: null, db: null };
};

// =======================================================
// 🧪 연결 테스트 (Health Check) 헬퍼 함수들
// =======================================================

/**
 * 🤖 Gemini API Key 유효성 핑 테스트
 */
export const testGeminiApiKey = async (apiKey: string): Promise<{ success: boolean; message: string }> => {
  if (!apiKey || apiKey.trim().length < 10) {
    return { success: false, message: 'Gemini API 키 형식이 올바르지 않습니다.' };
  }

  try {
    // REST API 엔드포인트를 통해 모델 리스트 조회 핑 테스트 (5초 타임아웃)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`,
      { method: 'GET', signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData?.error?.message || response.statusText;
      return { success: false, message: `Gemini API 인증 실패: ${errMsg}` };
    }

    return { success: true, message: 'Gemini AI 연결 성공! 키가 정상 작동합니다. ✅' };
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return { success: false, message: 'Gemini API 응답 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.' };
    }
    return { success: false, message: `네트워크 오류 또는 잘못된 키입니다: ${err.message}` };
  }
};

/**
 * 🔥 Firebase Firestore 데이터베이스 연결 및 권한 테스트 (4초 엄격 타임아웃 적용)
 */
export const testFirebaseConnection = async (
  config: CustomFirebaseConfig
): Promise<{ success: boolean; message: string }> => {
  let testApp: FirebaseApp | null = null;
  try {
    // 무한 재시도 대기를 방지하기 위한 4초 타임아웃 프로미스
    const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT_ERROR'));
      }, 4000);
    });

    const executionPromise = (async (): Promise<{ success: boolean; message: string }> => {
      testApp = initializeApp(config, `test_app_${Date.now()}`);
      const testDb = getFirestore(testApp);

      // 테스트용 임시 문서 쓰기/읽기/삭제 시도
      const testDocRef = doc(testDb, '_connection_test_', 'ping');
      await setDoc(testDocRef, {
        testAt: new Date().toISOString(),
        status: 'ok',
      });

      const docSnap = await getDoc(testDocRef);
      if (!docSnap.exists()) {
        return { success: false, message: 'Firestore에서 테스트 데이터를 읽어오지 못했습니다.' };
      }

      // 테스트 문서 정리
      await deleteDoc(testDocRef).catch(() => {});

      return { success: true, message: 'Firebase Firestore 데이터베이스 연결 성공! ✅' };
    })();

    const result = await Promise.race([executionPromise, timeoutPromise]);
    return result;
  } catch (err: any) {
    console.error('Firebase 연결 테스트 에러:', err);
    if (err.message === 'TIMEOUT_ERROR') {
      return {
        success: false,
        message: '연결 시간이 초과되었습니다. (Firestore 데이터베이스 생성 및 보안 규칙 게시 여부를 확인해 주세요.)',
      };
    }
    if (err.code === 'permission-denied') {
      return {
        success: false,
        message: 'Firestore 보안 규칙으로 인해 접근이 거부되었습니다. Firestore 규칙을 "allow read, write: if true;"로 설정해 주세요.',
      };
    }
    return {
      success: false,
      message: `Firebase 연결 실패: ${err.message || '설정값을 다시 확인해 주세요.'}`,
    };
  } finally {
    // 테스트 인스턴스 메모리 누수 방지
    if (testApp) {
      deleteApp(testApp).catch(() => {});
    }
  }
};
