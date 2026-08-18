import React, { useState, useEffect } from 'react';
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studentName) {
      setError('번호와 이름을 모두 입력해 주세요.');
      return;
    }

    setIsLoading(true);
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
        setError('등록되지 않은 번호이거나 이름이 일치하지 않습니다. 선생님께 확인해 보세요!');
      }
    } catch (err) {
      setError('로그인 중 문제가 발생했습니다. 다시 시도해 주세요.');
      console.error(err);
    } finally {
      setIsLoading(false);
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
            backgroundColor: 'var(--text-primary)', 
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            수학
          </div>
          <h2>아침활동 AI 코스웨어</h2>
          <p style={{ marginTop: '0.25rem' }}>오늘의 수학 문제를 풀기 위해 로그인해 주세요.</p>
        </div>

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">학급 반</label>
            <select
              className="input-control"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={isLoading}
            >
              {classList.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">학급 번호</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="예: 5"
              className="input-control"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">이름</label>
            <input
              type="text"
              placeholder="이름을 입력하세요"
              className="input-control"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-point"
            style={{ width: '100%', padding: '0.8rem' }}
            disabled={isLoading}
          >
            {isLoading ? '확인 중...' : '학습 시작하기'}
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
