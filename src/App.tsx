import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getActiveAuth } from './firebase';
import { isFirebaseActive } from './db';
import { Student } from './types';
import { loadAppConfig } from './config/appConfig';

// 컴포넌트 임포트
import { StudentLogin } from './components/StudentLogin';
import { StudentDashboard } from './components/StudentDashboard';
import { StudentSolve } from './components/StudentSolve';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { SetupModal } from './components/SetupModal';

function App() {
  // 모드 설정 ('student': 학생 화면, 'admin': 교사 관리자 화면)
  const [userMode, setUserMode] = useState<'student' | 'admin'>('student');

  // 학생 세션 상태
  const [studentUser, setStudentUser] = useState<Student | null>(null);
  const [solveDate, setSolveDate] = useState<string | null>(null); // 현재 풀고 있는 날짜

  // 교사(관리자) 세션 상태
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // 온보딩 설정 모달 상태 (미설정 시 필수 오픈)
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // 인증 상태 복원 함수
  const checkAuthStatus = useCallback(() => {
    const config = loadAppConfig();

    // 설정이 안 되어 있다면 첫 온보딩 모달 열기
    if (!config.isConfigured) {
      setIsSetupOpen(true);
    } else {
      setIsSetupOpen(false);
    }

    if (isFirebaseActive()) {
      try {
        const auth = getActiveAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setIsAdminAuthenticated(!!user);
          setAuthChecking(false);
        });
        return () => unsubscribe();
      } catch (e) {
        console.error('Auth 리스너 에러:', e);
        setAuthChecking(false);
      }
    } else {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    // 1. 학생 세션 자동 로그인 복원 (SessionStorage)
    const savedStudent = sessionStorage.getItem('loggedInStudent');
    if (savedStudent) {
      try {
        setStudentUser(JSON.parse(savedStudent));
      } catch (e) {
        console.error(e);
      }
    }

    // 2. 인증 및 설정 상태 확인
    const cleanup = checkAuthStatus();
    return () => {
      if (cleanup) cleanup();
    };
  }, [checkAuthStatus]);

  // 온보딩 완료 핸들러
  const handleSetupComplete = () => {
    setIsSetupOpen(false);
    // 설정 완료 후 교사 모드로 자동 전환 및 인증 상태 갱신
    setUserMode('admin');
    setIsAdminAuthenticated(true);
    checkAuthStatus();
  };

  // 학생 로그아웃
  const handleStudentLogout = () => {
    sessionStorage.removeItem('loggedInStudent');
    setStudentUser(null);
    setSolveDate(null);
  };

  // 교사 로그아웃
  const handleAdminLogout = async () => {
    if (isFirebaseActive()) {
      try {
        const auth = getActiveAuth();
        await signOut(auth);
        setIsAdminAuthenticated(false);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 교사 로그인 성공 핸들러
  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>
        <p style={{ color: '#64748B', fontWeight: 600 }}>초등 코스웨어 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* 1. 학생 모드 렌더링 */}
      {userMode === 'student' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!studentUser ? (
            // 학생 로그인 화면
            <StudentLogin
              onLoginSuccess={(student) => setStudentUser(student)}
              onSwitchToAdmin={() => setUserMode('admin')}
            />
          ) : !solveDate ? (
            // 학생 대시보드 (오늘의 문제 / 밀린 학습 선택)
            <StudentDashboard
              student={studentUser}
              onLogout={handleStudentLogout}
              onStartSolve={(date) => setSolveDate(date)}
            />
          ) : (
            // 학생 문제 풀이 학습창
            <StudentSolve
              student={studentUser}
              date={solveDate}
              onBackToDashboard={() => setSolveDate(null)}
            />
          )}
        </div>
      )}

      {/* 2. 교사(관리자) 모드 렌더링 */}
      {userMode === 'admin' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!isAdminAuthenticated ? (
            // 교사 로그인 화면
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onSwitchToStudent={() => setUserMode('student')}
            />
          ) : (
            // 교사 대시보드 허브
            <div>
              <AdminDashboard onLogout={handleAdminLogout} />
            </div>
          )}
        </div>
      )}

      {/* 🚀 최초 온보딩 및 빠른 설정 모달 */}
      <SetupModal
        isOpen={isSetupOpen}
        onComplete={handleSetupComplete}
      />
    </div>
  );
}

export default App;
