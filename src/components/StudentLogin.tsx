import React, { useState, useEffect, useRef } from 'react';
import { getAllStudents, getAllClasses } from '../db';
import { Student, SchoolClass } from '../types';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onSwitchToAdmin: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, onSwitchToAdmin }) => {
  const [classId, setClassId] = useState('1반');
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🌟 컴포넌트 마운트 시 동적 학급 반 목록 수립
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const list = await getAllClasses();
        setClassList(list);
        if (list.length > 0) {
          setClassId(list[0].name);
        }
      } catch (err) {
        console.error('로그인 학급 반 로드 오류:', err);
      }
    };
    loadClasses();
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studentName) {
      triggerError('번호와 이름을 입력해 주세요');
      return;
    }

    setIsLoading(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError('');

    try {
      const students = await getAllStudents(classId);
      // 번호를 2자리 포맷(예: "01", "05") 또는 입력 그대로 매칭
      const formattedId = studentId.padStart(2, '0');
      const foundStudent = students.find(
        (s) => (s.id === studentId || s.id === formattedId) && s.name.trim() === studentName.trim()
      );

      if (foundStudent) {
        sessionStorage.setItem('loggedInStudent', JSON.stringify(foundStudent));
        onLoginSuccess(foundStudent);
      } else {
        triggerError('일치하는 학생 정보가 없습니다');
      }
    } catch (err) {
      triggerError('로그인 오류가 발생했습니다');
      console.error(err);
    } finally {
      setIsLoading(false);
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
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">학급 반</label>
            <select
              className="input-control"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                if (error) {
                  if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
                  setError('');
                }
              }}
              disabled={isLoading}
            >
              {classList.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 번호와 이름을 한 줄로 배치하는 군더더기 없는 깔끔한 인라인 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">번호</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="예: 5"
                className="input-control"
                style={{ textAlign: 'center' }}
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value.replace(/[^0-9]/g, ''));
                  if (error) {
                    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
                    setError('');
                  }
                }}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">이름</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                className="input-control"
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  if (error) {
                    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
                    setError('');
                  }
                }}
                disabled={isLoading}
              />
            </div>
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
            {isLoading ? '확인 중...' : error ? error : '학습 시작하기'}
          </button>
        </form>

        <div style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center', 
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem'
        }}>
          <button
            onClick={onSwitchToAdmin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            선생님 로그인으로 전환
          </button>
        </div>
      </div>
    </div>
  );
};
