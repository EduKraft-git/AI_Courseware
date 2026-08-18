import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { Student } from './types';

// 컴포넌트 임포트
import { StudentLogin } from './components/StudentLogin';
import { StudentDashboard } from './components/StudentDashboard';
import { StudentSolve } from './components/StudentSolve';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  // 모드 설정 ('student': 학생 화면, 'admin': 교사 관리자 화면)
  const [userMode, setUserMode] = useState<'student' | 'admin'>('student');

  // 학생 세션 상태
  const [studentUser, setStudentUser] = useState<Student | null>(null);
  const [solveDate, setSolveDate] = useState<string | null>(null); // 현재 풀고 있는 날짜

  // 교사(관리자) 세션 상태
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Firebase 활성화 판단 플래그
  const isFirebaseActive = () => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    return !!apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY_HERE';
  };

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

    // 2. 교사 세션 복원
    if (isFirebaseActive()) {
      // Firebase Auth 상태 구독
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsAdminAuthenticated(!!user);
        setAuthChecking(false);
      });
      return () => unsubscribe();
    } else {
      // 로컬 오프라인 모드일 때 로컬 세션 복원
      const savedAdmin = localStorage.getItem('mock_admin_logged');
      setIsAdminAuthenticated(savedAdmin === 'true');
      setAuthChecking(false);
    }
  }, []);

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
        await signOut(auth);
        setIsAdminAuthenticated(false);
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.removeItem('mock_admin_logged');
      setIsAdminAuthenticated(false);
    }
  };

  // 교사 로그인 성공 핸들러
  const handleAdminLoginSuccess = () => {
    if (!isFirebaseActive()) {
      localStorage.setItem('mock_admin_logged', 'true');
    }
    setIsAdminAuthenticated(true);
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>인증 상태를 확인하고 있습니다...</p>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <AdminDashboard onLogout={handleAdminLogout} />
              
              <footer style={{ 
                marginTop: 'auto', 
                padding: '2rem 0 1rem', 
                borderTop: '1px solid var(--border-color)', 
                textAlign: 'center', 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)' 
              }}>
                <button 
                  onClick={() => setUserMode('student')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-point)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🏫 학생 학습창 화면으로 테스트 전환
                </button>
              </footer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
