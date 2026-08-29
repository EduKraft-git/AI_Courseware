import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getActiveFirebase, initFirebaseWithConfig } from './services/dynamicFirebase';
import { loadAppConfig, hasEnvFirebaseConfig } from './config/appConfig';

// 1. 환경변수 또는 로컬에 저장된 사용자 Firebase 설정 로드
const appConfig = loadAppConfig();

let app;
let authInstance: Auth;
let dbInstance: Firestore;

if (appConfig.firebaseConfig && appConfig.firebaseConfig.apiKey) {
  const result = initFirebaseWithConfig(appConfig.firebaseConfig);
  app = result.app;
  authInstance = result.auth;
  dbInstance = result.db;
} else if (hasEnvFirebaseConfig()) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
} else {
  // 더미 앱 초기화 (초기 에러 방지용)
  const dummyConfig = {
    apiKey: 'AIzaSyDummyKeyForInitialization12345',
    authDomain: 'dummy-app.firebaseapp.com',
    projectId: 'dummy-app',
    storageBucket: 'dummy-app.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456:web:dummy',
  };
  app = getApps().length > 0 ? getApp() : initializeApp(dummyConfig, 'dummy_app');
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

// 외부에서 동적으로 최신 인스턴스를 얻기 위한 게터
export const getActiveAuth = (): Auth => {
  const dynamic = getActiveFirebase();
  return dynamic.auth || authInstance;
};

export const getActiveDb = (): Firestore => {
  const dynamic = getActiveFirebase();
  return dynamic.db || dbInstance;
};

// 기존 코드와의 하위 호환성을 위한 export
export const auth = authInstance;
export const db = dbInstance;
export default app;
