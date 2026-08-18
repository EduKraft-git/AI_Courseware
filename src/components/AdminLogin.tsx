import React, { useState } from 'react';
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

  // Firebase 활성화 상태 확인
  const isFirebaseActive = () => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    return !!apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY_HERE';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    if (isFirebaseActive()) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else {
          setError('로그인 중 에러가 발생했습니다. 다시 시도해 주세요.');
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
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--color-point)', 
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            교사
          </div>
          <h2>관리자 대시보드 로그인</h2>
          <p style={{ marginTop: '0.25rem' }}>선생님 계정으로 로그인해 주세요.</p>
        </div>

        {!isFirebaseActive() && (
          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid var(--color-warning)',
            color: 'var(--text-primary)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '1.25rem',
            lineHeight: '1.4'
          }}>
            ⚠️ <strong>로컬 오프라인 모드 작동 중:</strong><br />
            현재 Firebase 연결 설정이 확인되지 않아 오프라인 가상 모드로 실행됩니다. 아무 이메일과 비밀번호를 입력하셔도 정상 접속됩니다.
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--color-error)',
            color: 'var(--color-error)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">교사 이메일</label>
            <input
              type="email"
              placeholder="teacher@school.club"
              className="input-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">비밀번호</label>
            <input
              type="password"
              placeholder="••••••••"
              className="input-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', backgroundColor: 'var(--text-primary)' }}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '관리자 페이지 진입'}
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
