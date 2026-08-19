import React, { useState, useEffect, useRef } from 'react';
import { getProblem, getStudentSubmissions, submitAnswer, markProblemStarted, updateStudentActiveStatus, setStudentOffline } from '../db';
import { Student, Problem, Question, Submission } from '../types';

// 🌟 입력 형식 안내(answerGuide)에서 실제 문제의 정답이 노출되지 않도록 범용 형식으로 정제하는 함수
const sanitizeAnswerGuide = (guide?: string, answers?: string[]): string => {
  if (!guide) return '정답을 알맞은 형식으로 입력하세요.';
  let sanitized = guide;
  if (answers && answers.length > 0) {
    for (const ans of answers) {
      const cleanAns = String(ans).trim();
      if (!cleanAns) continue;
      const escaped = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(sanitized)) {
        if (cleanAns.includes('/') && cleanAns.includes(' ')) {
          sanitized = sanitized.replace(regex, '1 1/2');
        } else if (cleanAns.includes('/')) {
          sanitized = sanitized.replace(regex, '1/2');
        } else if (cleanAns.includes('.')) {
          sanitized = sanitized.replace(regex, '0.5');
        } else if (/^\d+$/.test(cleanAns)) {
          sanitized = sanitized.replace(regex, '10');
        } else {
          sanitized = sanitized.replace(regex, '○');
        }
      }
    }
  }
  return sanitized;
};

interface StudentSolveProps {
  student: Student;
  date: string; // 문제를 풀 날짜
  onBackToDashboard: () => void;
}

export const StudentSolve: React.FC<StudentSolveProps> = ({
  student,
  date,
  onBackToDashboard,
}) => {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // 현재 풀고 있는 문제의 인덱스
  const [inputValue, setInputValue] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSolved, setIsSolved] = useState(false); // 현재 문제를 맞추었는지 여부

  // 임시값 보관 캐시
  const [tempInputs, setTempInputs] = useState<{ [questionId: number]: string }>({});
  
  // 개별 문항별 순수 풀이 소요 시간 (초)
  const [elapsedTimes, setElapsedTimes] = useState<{ [questionId: number]: number }>({});

  // 데이터 로드
  useEffect(() => {
    const loadProblemData = async () => {
      setIsLoading(true);
      try {
        const prob = await getProblem(date);
        setProblem(prob);

        if (prob) {
          // 기존 제출 내역 가져오기 (반 격리 포함)
          const subs = await getStudentSubmissions(date, student.classId, student.id);
          setSubmissions(subs);

          // ✅ 문제 풀기를 시작했다는 마커를 DB에 기록 (관리자 현황판에서 "진행중"으로 표시됨)
          await markProblemStarted(prob.date, student.classId, student.id, prob.id);

          // 이미 푼 문제들이 있다면 가장 마지막 미완료 문제로 이동
          let firstUnsolvedIndex = 0;
          for (let i = 0; i < prob.questions.length; i++) {
            const q = prob.questions[i];
            const isCompleted = subs.some(s => s.classId === student.classId && s.questionId === q.id && s.isCompleted);
            if (!isCompleted) {
              firstUnsolvedIndex = i;
              break;
            }
            if (i === prob.questions.length - 1) {
              firstUnsolvedIndex = prob.questions.length;
            }
          }
          setCurrentIndex(firstUnsolvedIndex);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadProblemData();
  }, [date, student.classId, student.id]);

  const isFinishedAll = problem ? currentIndex >= problem.questions.length : false;

  // 문항별 스마트 타이머 작동 (활성화 상태에서만 초당 1가산)
  useEffect(() => {
    if (isFinishedAll || isSolved || isLoading || !problem) return;

    const currentQ = problem.questions[currentIndex];
    if (!currentQ) return;

    const interval = setInterval(() => {
      setElapsedTimes(prev => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + 1
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, isSolved, isFinishedAll, isLoading, problem]);

  // 실시간 온라인 하트비트 작동 (30초 주기) 및 이탈/종료 시 즉시 오프라인 전환
  useEffect(() => {
    updateStudentActiveStatus(student.classId, student.id);
    
    const interval = setInterval(() => {
      updateStudentActiveStatus(student.classId, student.id);
    }, 30000);

    const handleBeforeUnload = () => {
      setStudentOffline(student.classId, student.id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      setStudentOffline(student.classId, student.id);
    };
  }, [student.classId, student.id]);

  // 🌟 오직 문제 번호(currentIndex)가 실제로 전환될 때만 힌트와 피드백 상태를 리셋하여, 제출 시 리셋 덮어쓰기 현상을 원천 방어함
  useEffect(() => {
    setShowHint(false);
    setFeedback({ type: '', message: '' });
  }, [currentIndex]);

  // 문제 전환 시 타이머 시작 시간 리셋 및 입력값 복구
  useEffect(() => {
    if (problem && currentIndex < problem.questions.length) {
      const currentQ = problem.questions[currentIndex];
      const submission = submissions.find(s => s.questionId === currentQ.id && s.classId === student.classId);
      const isCompleted = submission?.isCompleted || false;
      setIsSolved(isCompleted);

      // 이미 풀어서 정답 처리된 문제라면 정답 입력창에 자기가 썼던 최종 답을 보여줌
      if (isCompleted && submission) {
        const lastValue = submission.history && submission.history.length > 0
          ? submission.history[submission.history.length - 1].submittedValue
          : (currentQ.answers[0] || '');
        setInputValue(lastValue);
      } else {
        // 아직 풀리지 않은 문제라면 임시 입력 보관소(tempInputs)에서 복구하거나 빈 텍스트 노출
        setInputValue(tempInputs[currentQ.id] || '');
      }
    }
  }, [currentIndex, problem, submissions, tempInputs, student.classId]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '5rem' }}>문제를 불러오고 있습니다...</div>;
  }

  if (!problem) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div className="card">
          <h2>문제를 찾을 수 없습니다.</h2>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>선택하신 날짜의 문제가 존재하지 않습니다.</p>
          <button onClick={onBackToDashboard} className="btn btn-primary">돌아가기</button>
        </div>
      </div>
    );
  }

  const questions = problem.questions;

  // 전체 진행 상황 계산
  const totalQuestions = questions.length;
  const currentStep = currentIndex + 1;
  const progressPercent = Math.min(100, Math.round(((isFinishedAll ? totalQuestions : currentIndex) / totalQuestions) * 100));

  // 정답 문자열 정제 비교 함수
  const checkAnswer = (studentInput: string, answers: string[]): boolean => {
    const cleanStr = (str: string) => 
      str.trim()
         .replace(/\s+/g, '') // 공백 제거
         .replace(/,/g, '')   // 쉼표 제거 (있을 시)
         .toLowerCase();

    const cleanedInput = cleanStr(studentInput);
    return answers.some(ans => cleanStr(ans) === cleanedInput);
  };

  // 답안 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    const currentQuestion = questions[currentIndex];
    
    // 개별 문항 타이머에서 정밀 누계된 순수 풀이 소요 시간 (최소 1초 보장)
    const elapsedTime = Math.max(1, elapsedTimes[currentQuestion.id] || 1);
    const isCorrect = checkAnswer(inputValue, currentQuestion.answers);

    try {
      // DB에 제출 기록 (반 정보 classId 전달 연계 완료)
      await submitAnswer(
        problem.date,
        student.classId,
        student.id,
        currentQuestion.id,
        inputValue.trim(),
        isCorrect,
        elapsedTime,
        problem.id
      );

      if (isCorrect) {
        // 정답일 시 딜레이 없이 즉각 다음 문제로 넘어가게 조율 (버튼 스위칭 및 화면 꿀렁임 제거)
        const updatedSubs = [...submissions];
        const existingIdx = updatedSubs.findIndex(s => s.questionId === currentQuestion.id && s.classId === student.classId);
        
        const newHistoryItem = {
          submittedValue: inputValue.trim(),
          isCorrect: true,
          elapsedTime,
          submittedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          updatedSubs[existingIdx].isCompleted = true;
          updatedSubs[existingIdx].attempts += 1;
          updatedSubs[existingIdx].history.push(newHistoryItem);
        } else {
          updatedSubs.push({
            id: `${problem.id}_${student.classId}_${student.id}_${currentQuestion.id}`,
            date,
            classId: student.classId,
            problemId: problem.id,
            studentId: student.id,
            questionId: currentQuestion.id,
            attempts: 1,
            history: [newHistoryItem],
            isCompleted: true
          });
        }
        setSubmissions(updatedSubs);

        // 🌟 이전에 이 문항을 틀린 적이 있는지 이력 검사
        const isWrongBefore = existingIdx !== -1 
          ? updatedSubs[existingIdx].history.some(h => !h.isCorrect)
          : false;

        if (isWrongBefore) {
          // 이전에 틀렸다가 다시 맞춰 극복한 경우: 즉시 넘어가지 않고 상세 문제 풀이를 정독할 수 있게 멈춤!
          setIsSolved(true);
          setFeedback({ type: 'success', message: '대단해요! 포기하지 않고 다시 풀어 마침내 성공했습니다!' });
        } else {
          // 한 번에 맞춘 경우: 0초 딜레이로 즉각 다음 문항 스위칭
          setInputValue(''); 
          setFeedback({ type: '', message: '' }); 
          setCurrentIndex(prev => prev + 1); 
        }
      } else {
        setFeedback({ type: 'error', message: '틀렸습니다. 다시 한번 꼼꼼하게 생각해 볼까요?' });
        setShowHint(true); // 오답 시 힌트 강제 노출
        
        // 오답 기록도 클라이언트 측 submissions 상태에 동기화하여 결과 리포트에 반영되도록 추가
        const updatedSubs = [...submissions];
        const existingIdx = updatedSubs.findIndex(s => s.questionId === currentQuestion.id && s.classId === student.classId);
        
        const newHistoryItem = {
          submittedValue: inputValue.trim(),
          isCorrect: false,
          elapsedTime,
          submittedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          updatedSubs[existingIdx].attempts += 1;
          updatedSubs[existingIdx].history.push(newHistoryItem);
        } else {
          updatedSubs.push({
            id: `${problem.id}_${student.classId}_${student.id}_${currentQuestion.id}`,
            date,
            classId: student.classId,
            problemId: problem.id,
            studentId: student.id,
            questionId: currentQuestion.id,
            attempts: 1,
            history: [newHistoryItem],
            isCompleted: false
          });
        }
        setSubmissions(updatedSubs);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: '전송 중 문제가 발생했습니다. 다시 시도해 주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (isSolved) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '650px' }}>
      {/* 학습창 헤더 */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', width: '100%' }}>
        <button onClick={onBackToDashboard} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
          나가기
        </button>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', flex: 1, minWidth: 0 }}>
          {problem.chapter}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {student.classId} {student.name}
        </div>
      </header>

      {/* 상단 진행률 프로그레스 바 */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          <span>진행 상황</span>
          <span>
            {isFinishedAll ? '완료!' : `${currentStep} / ${totalQuestions} 문제`} ({progressPercent}%)
          </span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: 'var(--color-point)', transition: 'width 0.4s ease' }}></div>
        </div>
      </div>

      {isFinishedAll ? (
        // 모든 문제 해결 완료 화면 및 자가 피드백 결과 리포트
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
            <h2 style={{ marginBottom: '0.75rem' }}>오늘의 아침활동 완료!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              모든 수학 문제를 성실하게 풀어냈습니다.<br />
              끈기 있게 도전한 스스로에게 칭찬해 주세요!
            </p>
            <button
              onClick={onBackToDashboard}
              className="btn btn-primary btn-point"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginBottom: '1.5rem' }}
            >
              나의 학습창으로 돌아가기
            </button>

            {/* 자가 학습 결과 분석 리포트 카드 (Bento Grid 스타일) */}
            <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '2rem', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--color-point)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                나의 학습 결과 분석 리포트
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                스스로 틀린 내용과 고민 시간을 복기하며 메타인지 능력을 길러보세요.
              </p>
              
              <div className="grid grid-cols-1" style={{ gap: '0.75rem' }}>
                {questions.map((q) => {
                  const sub = submissions.find(s => s.questionId === q.id && s.classId === student.classId);
                  const incorrectAttempts = sub?.history.filter(h => !h.isCorrect) || [];
                  const wrongValues = incorrectAttempts.map(h => h.submittedValue);
                  // 전체 풀이 시간 적산
                  const totalSeconds = sub?.history.reduce((sum, h) => sum + h.elapsedTime, 0) || elapsedTimes[q.id] || 0;
                  
                  return (
                    <div key={q.id} className="card" style={{ padding: '1rem', backgroundColor: '#f9fafb', border: '1px solid #f1f5f9', boxShadow: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          문제 {q.id}
                        </span>
                        <span className="badge badge-indigo" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                          {sub ? `${sub.attempts}회 시도` : '1회 시도'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <div><strong>고민한 시간:</strong> {totalSeconds}초</div>
                        {wrongValues.length > 0 ? (
                          <div style={{ color: '#ef4444', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                            <strong>내가 쓴 오답:</strong> {wrongValues.join(', ')}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--color-success)', marginTop: '0.25rem' }}>
                            <strong>실수 없이 한 번에 성공!</strong>
                          </div>
                        )}
                        
                        {/* 🌟 틀렸다 맞춘 문항에만 결과 분석창 내에 '문제 풀이' 카드 노출 */}
                        {wrongValues.length > 0 && (
                          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-success)', marginBottom: '0.25rem' }}>문제 풀이:</div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{q.explanation || '상세 풀이가 준비되지 않았습니다.'}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // 문제 풀이 화면
        <div>
          <div className="card" style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* 문제 번호 뱃지 */}
              <span className="badge badge-indigo" style={{ marginBottom: '1rem', padding: '0.3rem 0.6rem' }}>
                Q{questions[currentIndex].id}
              </span>
              
              {/* 문제 발문 */}
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: '1.5', wordBreak: 'keep-all', marginBottom: '1.5rem' }}>
                {questions[currentIndex].questionText}
              </h2>
            </div>

            {/* 정답 가이드 안내 (정답 유출 완벽 차단 및 형식만 안내) */}
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(0,0,0,0.02)',
              borderLeft: '4px solid var(--text-primary)',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              <strong>입력 형식 안내:</strong> {sanitizeAnswerGuide(questions[currentIndex].answerGuide, questions[currentIndex].answers)}
            </div>
          </div>

          {/* 답안 입력 폼 (모바일 터치 및 반응형 플렉스 적용) */}
          <form onSubmit={handleSubmit} style={{ marginTop: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
              <input
                type="text"
                placeholder="정답 입력"
                className="input-solve"
                style={{ 
                  flex: 1,
                  minWidth: 0,
                  border: isSolved ? '2.5px solid var(--color-success)' : undefined,
                  backgroundColor: isSolved ? 'rgba(16, 185, 129, 0.02)' : undefined,
                  color: isSolved ? 'var(--color-success)' : undefined
                }}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  const currentQ = questions[currentIndex];
                  if (currentQ) {
                    setTempInputs(prev => ({ ...prev, [currentQ.id]: e.target.value }));
                  }
                }}
                disabled={isSolved || isSubmitting}
                autoComplete="off"
              />
              {!isSolved ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '0 1.5rem', fontSize: '1rem', borderRadius: '14px', flexShrink: 0 }}
                  disabled={isSubmitting || !inputValue.trim()}
                >
                  제출
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="btn btn-primary btn-point"
                  style={{ whiteSpace: 'nowrap', padding: '0 1.25rem', fontSize: '1rem', borderRadius: '14px', flexShrink: 0 }}
                >
                  다음 문제
                </button>
              )}
            </div>
          </form>

          {/* 실시간 피드백 알림 */}
          {feedback.message && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`,
              color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {feedback.type === 'success' ? '✔️' : '❌'} {feedback.message}
            </div>
          )}

          {/* 오답 시 힌트 창 (정답을 맞춘 상태가 아닐 때만 힌트 노출) */}
          {showHint && !isSolved && (
            <div className="card" style={{ 
              backgroundColor: 'rgba(6, 78, 59, 0.03)', 
              borderColor: 'var(--color-point-light)',
              padding: '1.5rem',
              animation: 'fadeIn 0.3s ease',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-point)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                힌트 (푸는 방법)
              </h4>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {questions[currentIndex].hint || '해당 문제의 핵심 공식을 다시 한 번 차분히 점검해 보세요.'}
              </p>
            </div>
          )}

          {/* 🌟 틀렸다 맞춘 경우에만 실시간으로 등장하는 신설 '문제 풀이' 카드 */}
          {isSolved && (() => {
            const currentQ = questions[currentIndex];
            const sub = submissions.find(s => s.questionId === currentQ.id && s.classId === student.classId);
            const isWrongBefore = sub ? sub.history.some(h => !h.isCorrect) : false;
            
            if (!isWrongBefore) return null;
            
            return (
              <div className="card" style={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.02)', 
                borderColor: 'var(--color-success)',
                padding: '1.5rem',
                animation: 'fadeIn 0.3s ease',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-success)', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                  문제 풀이 (다시 풀어 성공 완료!)
                </h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {currentQ.explanation || '상세 풀이가 준비되지 않았습니다. 교과서를 바탕으로 오답 노트를 복기해 보세요.'}
                </p>
              </div>
            );
          })()}

          {/* 이전/다음 문제 네비게이션 버튼 바 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '2rem', 
            gap: '1rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1.5rem'
          }}>
            {currentIndex > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="btn btn-secondary"
                style={{ 
                  flex: 1, 
                  padding: '0.75rem', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.25rem' 
                }}
              >
                이전 문제
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {isSolved && currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="btn btn-secondary"
                style={{ 
                  flex: 1, 
                  padding: '0.75rem', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.25rem' 
                }}
              >
                다음 문제
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
