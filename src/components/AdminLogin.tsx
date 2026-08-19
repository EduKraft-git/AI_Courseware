import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onSwitchToStudent: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onSwitchToStudent }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Firebase 활성화 상태 확인
  const isFirebaseActive = () => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    return !!apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY_HERE';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      triggerError('이메일과 비밀번호를 입력해 주세요');
      return;
    }

    setIsLoading(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError('');

    if (isFirebaseActive()) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          triggerError('계정 정보가 일치하지 않습니다');
        } else {
          triggerError('로그인 오류가 발생했습니다');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // 로컬 스토리지 오프라인 모드일 때 임시 패스
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess();
      }, 500);
    }
  };

  // 1.5초간 버튼에 에러 메시지를 표시한 후 부드럽게 복귀시키는 헬퍼
  const triggerError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => {
      setError('');
    }, 1500);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      width: '100%',
      padding: '1rem 0.5rem'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">교사 이메일</label>
            <input
              type="email"
              placeholder="teacher@school.club"
              className="input-control"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) {
                  if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
                  setError('');
                }
              }}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">비밀번호</label>
            <input
              type="password"
              placeholder="••••••••"
              className="input-control"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) {
                  if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
                  setError('');
                }
              }}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '0.8rem',
              backgroundColor: error ? 'var(--color-error)' : 'var(--color-point)',
              boxShadow: error ? '0 4px 14px rgba(225, 29, 72, 0.3)' : 'var(--shadow-button)',
              transition: 'background-color 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1), color 0.35s ease'
            }}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : error ? error : '관리자 페이지 진입'}
          </button>
        </form>

        <div style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center', 
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem'
        }}>
          <button
            onClick={onSwitchToStudent}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            학생 로그인으로 전환
          </button>
        </div>
      </div>
    </div>
  );
};
