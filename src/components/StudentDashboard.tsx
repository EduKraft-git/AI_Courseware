import React, { useState, useEffect } from 'react';
import { 
  getDailyProblems, 
  getDailyAttendance, 
  getStudentSubmissions, 
  getUnfinishedProblems, 
  updateStudentActiveStatus, 
  setStudentOffline,
  getStudentAttendanceList,
  getAllProblems,
  getAllStudentSubmissions
} from '../db';
import { Student, Problem, Attendance, Submission } from '../types';

interface StudentDashboardProps {
  student: Student;
  onLogout: () => void;
  onStartSolve: (problemId: string) => void;
}

interface ProblemWithStatus extends Problem {
  isCompleted: boolean;
  completedCount: number;
  totalQuestions: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onLogout,
  onStartSolve,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'pending' | 'calendar'>('today');
  const [todayProblems, setTodayProblems] = useState<ProblemWithStatus[]>([]);
  const [isAbsent, setIsAbsent] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [pendingProblems, setPendingProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 학습 달력 관련 신규 상태 추가
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarProblems, setCalendarProblems] = useState<Problem[]>([]);
  const [calendarSubmissions, setCalendarSubmissions] = useState<Submission[]>([]);
  const [calendarAttendances, setCalendarAttendances] = useState<Attendance[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // 한국 시간 기준 YYYY-MM-DD 가져오기
  const getTodayString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISODate = new Date(now.getTime() - offset).toISOString().split('T')[0];
    return localISODate;
  };

  const todayStr = getTodayString();

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. 출결(결석) 현황 검사
        const dailyAttendance = await getDailyAttendance(todayStr, student.classId);
        const myAttendance = dailyAttendance.find(a => a.studentId === student.id);
        if (myAttendance && myAttendance.status !== 'present') {
          setIsAbsent(true);
          setAbsentReason(
            myAttendance.status === 'absent_ill' ? '질병 결석' : '출석 인정 결석'
          );
        }

        // 2. 오늘의 문제 세트들 로드 (다중 유형 배포 지원, 학생 반 필터 적용)
        const problems = await getDailyProblems(todayStr, student.classId);

        // 3. 각 문제 세트 완료 여부 검사
        const listWithStatus = await Promise.all(problems.map(async (p) => {
          const submissions = await getStudentSubmissions(p.id, student.classId, student.id);
          const totalQuestions = p.questions.length;
          const completedCount = submissions.filter(s => s.isCompleted).length;
          const isCompleted = completedCount >= totalQuestions && totalQuestions > 0;
          return {
            ...p,
            isCompleted,
            completedCount,
            totalQuestions
          };
        }));
        setTodayProblems(listWithStatus);

        // 4. 밀린 학습(미완료 학습) 문제 세트 목록 로드 (날짜 대신 문제 단위 리스트)
        const unfinished = await getUnfinishedProblems(student.classId, student.id, todayStr);
        setPendingProblems(unfinished);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [student.id, todayStr]);

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

  // 🌟 탭이 달력으로 바뀔 때 달력용 데이터 일괄 로드
  useEffect(() => {
    if (activeTab !== 'calendar') return;

    const loadCalendarData = async () => {
      setIsLoadingCalendar(true);
      try {
        const atts = await getStudentAttendanceList(student.classId, student.id);
        setCalendarAttendances(atts);

        const subs = await getAllStudentSubmissions(student.classId, student.id);
        setCalendarSubmissions(subs);

        const probs = await getAllProblems();
        const filteredProbs = probs.filter(p => (p.targetClasses || ['1반']).includes(student.classId));
        setCalendarProblems(filteredProbs);
      } catch (err) {
        console.error('달력 데이터 로드 오류:', err);
      } finally {
        setIsLoadingCalendar(false);
      }
    };

    loadCalendarData();
  }, [activeTab, student.id, student.classId]);

  return (
    <div className="app-container">
      {/* 학생 대시보드 헤더 */}
      <header className="app-header">
        <div className="app-logo">
          <div className="logo-dot"></div>
          <span>{student.id}번 {student.name} 학생의 학습창</span>
        </div>
        <button 
          onClick={async () => {
            await setStudentOffline(student.classId, student.id);
            onLogout();
          }} 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          로그아웃
        </button>
      </header>

      {/* 탭 네비게이션 (모바일 가로 스크롤 지원 및 2줄 깨짐 완벽 방어) */}
      <div className="tab-scroll-container">
        <button
          className={`btn tab-btn-pill ${activeTab === 'today' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('today')}
        >
          오늘의 아침활동
        </button>
        <button
          className={`btn tab-btn-pill ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pending')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          밀린 학습
          {pendingProblems.length > 0 && (
            <span style={{
              backgroundColor: 'var(--color-error)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              {pendingProblems.length}
            </span>
          )}
        </button>
        <button
          className={`btn tab-btn-pill ${activeTab === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('calendar')}
        >
          학습 달력
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>데이터를 불러오는 중입니다...</div>
      ) : (
        <div>
          {/* 오늘의 아침활동 탭 */}
          {activeTab === 'today' && (
            <div className="card" style={{ padding: '2.5rem 2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <span className="badge badge-indigo" style={{ marginBottom: '0.5rem' }}>오늘 날짜: {todayStr}</span>
                <h2>오늘의 아침활동</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  선생님이 오늘 날짜로 배포하신 수학 학습 미션 목록입니다.
                </p>
              </div>

              {isAbsent ? (
                // 결석 안내 화면
                <div style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1px dashed var(--color-warning)',
                  borderRadius: '12px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center'
                }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>오늘은 공식적인 결석일입니다.</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    선생님이 오늘의 아침활동을 <strong>{absentReason}</strong> 처리하셨습니다. <br />
                    오늘은 푹 쉬고 건강하게 등교하세요!
                  </p>
                </div>
              ) : todayProblems.length > 0 ? (
                // 오늘의 문제가 있는 경우 (다중 벤토 리스트 형태 제공)
                <div className="grid grid-cols-2" style={{ gap: '1.25rem', marginTop: '1.5rem' }}>
                  {todayProblems.map((prob) => {
                    return (
                      <div 
                        key={prob.id}
                        className="card"
                        style={{ 
                          padding: '1.5rem', 
                          border: prob.isCompleted ? '1px solid var(--color-success)' : '1px solid var(--border-color)',
                          backgroundColor: prob.isCompleted ? 'rgba(16, 185, 129, 0.01)' : 'var(--bg-card)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span className="badge badge-indigo">{prob.grade}</span>
                          {prob.isCompleted ? (
                            <span className="badge badge-green">학습 완료</span>
                          ) : prob.completedCount > 0 ? (
                            <span className="badge badge-indigo">진행중 ({prob.completedCount}/{prob.totalQuestions})</span>
                          ) : (
                            <span className="badge badge-gray">미시작</span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.2rem', margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                          {prob.chapter}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                          유형: {prob.type} / 문항 수: {prob.totalQuestions}문제
                        </p>

                        <button
                          onClick={() => onStartSolve(prob.id)}
                          className={`btn ${prob.isCompleted ? 'btn-secondary' : 'btn-primary btn-point'}`}
                          style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', marginTop: 'auto' }}
                        >
                          {prob.isCompleted ? '제출 기록 확인 및 복습' : '아침활동 시작하기'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // 배포된 문제가 없는 경우
                <div style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '3rem 1.5rem',
                  textAlign: 'center'
                }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>대기 중</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    아직 선생님이 배포하신 오늘의 수학 문제가 없습니다.<br />
                    잠시 기다린 후 새로고침하거나 대기해 주세요.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 밀린 학습 탭 */}
          {activeTab === 'pending' && (
            <div className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>다 하지 못했던 아침활동</h2>
              <p style={{ marginBottom: '1.5rem' }}>이전에 미완료했거나 깜빡하고 제출하지 못한 아침 수학 활동 목록입니다. 언제든 다시 이어서 풀 수 있어요!</p>

              {pendingProblems.length > 0 ? (
                <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                  {pendingProblems.map(prob => (
                    <div
                      key={prob.id}
                      className="card"
                      style={{
                        padding: '1.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="badge badge-gray">{prob.date} 배포</span>
                        <span className="badge badge-indigo">{prob.grade}</span>
                      </div>
                      
                      <h3 style={{ fontSize: '1.15rem', margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                        {prob.chapter}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        유형: {prob.type} / {prob.questions.length}문항
                      </p>

                      <button
                        onClick={() => onStartSolve(prob.id)}
                        className="btn btn-secondary"
                        style={{ width: '100%', borderColor: 'var(--color-point)', color: 'var(--color-point)', padding: '0.75rem', fontSize: '0.9rem', marginTop: 'auto' }}
                      >
                        이어서 풀기
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '3rem 1.5rem',
                  textAlign: 'center'
                }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>밀린 학습 없음</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    밀린 학습이 하나도 없습니다! 아주 성실하게 완료하셨네요. 참 잘했어요!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 학습 달력 탭 */}
          {activeTab === 'calendar' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>학습 달력</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    매일의 아침활동 달성 상태와 출결 이력을 확인할 수 있습니다.
                  </p>
                </div>
                
                {/* 월 네비게이션 */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f1f5f9', padding: '0.35rem 0.75rem', borderRadius: '10px' }}>
                  <button 
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', padding: '0 0.35rem' }}
                  >
                    &lt;
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: '80px', textAlign: 'center' }}>
                    {calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월
                  </span>
                  <button 
                    onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', padding: '0 0.35rem' }}
                  >
                    &gt;
                  </button>
                </div>
              </div>

              {isLoadingCalendar ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>달성 현황을 분석하고 있습니다...</div>
              ) : (
                <div>
                  {/* 달력 요일 헤더 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <div style={{ color: '#ef4444' }}>일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div style={{ color: 'var(--color-point)' }}>토</div>
                  </div>

                  {/* 달력 일자 그리드 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                    {(() => {
                      const year = calendarDate.getFullYear();
                      const month = calendarDate.getMonth();
                      
                      // 이번 달 첫날의 요일 (0: 일요일, 6: 토요일)
                      const firstDayIndex = new Date(year, month, 1).getDay();
                      // 이번 달 총 일수
                      const totalDays = new Date(year, month + 1, 0).getDate();
                      
                      const cells = [];
                      
                      // 1. 이전 달 빈 칸 채우기
                      for (let i = 0; i < firstDayIndex; i++) {
                        cells.push(<div key={`empty-${i}`} style={{ minHeight: '75px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }} />);
                      }
                      
                      // 2. 이번 달 일자 채우기
                      for (let day = 1; day <= totalDays; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dateProblems = calendarProblems.filter(p => p.date === dateStr);
                        
                        const myAtt = calendarAttendances.find(a => a.date === dateStr);
                        const isAbsentOnDate = myAtt && myAtt.status !== 'present';
                        const absentLabel = myAtt?.status === 'absent_ill' ? '결석(질병)' : '결석(인정)';
                        
                        let hasProblems = dateProblems.length > 0;
                        let allDone = false;
                        let anyAttempt = false;
                        
                        if (hasProblems) {
                          let totalQCount = dateProblems.reduce((sum, p) => sum + p.questions.length, 0);
                          let completedQCount = 0;
                          
                          dateProblems.forEach(p => {
                            const pSubs = calendarSubmissions.filter(s => s.problemId === p.id && s.questionId !== 0);
                            completedQCount += pSubs.filter(s => s.isCompleted).length;
                            if (pSubs.length > 0) anyAttempt = true;
                          });
                          
                          allDone = completedQCount >= totalQCount && totalQCount > 0;
                        }

                        let cellBg = '#ffffff';
                        let cellBorder = '1px solid var(--border-color)';
                        let statusText = '';
                        let statusColor = 'var(--text-secondary)';
                        
                        if (isAbsentOnDate) {
                          cellBg = '#fffbeb';
                          cellBorder = '1px dashed #f59e0b';
                          statusText = absentLabel;
                          statusColor = '#d97706';
                        } else if (hasProblems) {
                          if (allDone) {
                            cellBg = 'rgba(16, 185, 129, 0.03)';
                            cellBorder = '1.5px solid var(--color-success)';
                            statusText = '완료';
                            statusColor = 'var(--color-success)';
                          } else if (anyAttempt) {
                            cellBg = 'rgba(79, 70, 229, 0.02)';
                            cellBorder = '1.5px solid var(--color-point)';
                            statusText = '진행중';
                            statusColor = 'var(--color-point)';
                          } else {
                            cellBg = 'rgba(239, 68, 68, 0.02)';
                            cellBorder = '1.5px solid #f87171';
                            statusText = '미달성';
                            statusColor = '#ef4444';
                          }
                        }

                        const cellDayOfWeek = new Date(year, month, day).getDay();
                        let dayNumColor = 'var(--text-primary)';
                        if (cellDayOfWeek === 0) dayNumColor = '#ef4444';
                        if (cellDayOfWeek === 6) dayNumColor = 'var(--color-point)';
                        
                        cells.push(
                          <div 
                            key={`day-${day}`} 
                            style={{ 
                              minHeight: '75px', 
                              backgroundColor: cellBg, 
                              border: cellBorder, 
                              borderRadius: '8px', 
                              padding: '0.35rem 0.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: dayNumColor }}>
                              {day}
                            </span>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden', minWidth: 0 }}>
                              {isAbsentOnDate ? (
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 800, 
                                  color: statusColor,
                                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                                  padding: '0.15rem 0.35rem',
                                  borderRadius: '5px',
                                  textAlign: 'center',
                                  display: 'inline-block'
                                }}>
                                  {statusText}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
                                  {dateProblems.map((p) => {
                                    const pSubs = calendarSubmissions.filter(s => s.problemId === p.id && s.questionId !== 0);
                                    const pCompletedCount = pSubs.filter(s => s.isCompleted).length;
                                    const pTotalCount = p.questions.length;
                                    const pAnyAttempt = pSubs.length > 0;
                                    const pIsDone = pCompletedCount >= pTotalCount && pTotalCount > 0;
                                    
                                    const pStatusText = pIsDone ? '완료' : pAnyAttempt ? '진행' : '미작';
                                    const pStatusColor = pIsDone ? 'var(--color-success)' : pAnyAttempt ? 'var(--color-point)' : '#6b7280';
                                    const pStatusBg = pIsDone ? 'rgba(16, 185, 129, 0.08)' : pAnyAttempt ? 'rgba(79, 70, 229, 0.08)' : '#f3f4f6';

                                    return (
                                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', minWidth: 0 }}>
                                        <span 
                                          style={{ 
                                            fontSize: '0.65rem', 
                                            color: 'var(--text-muted)', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap', 
                                            fontWeight: 600,
                                            flex: 1
                                          }} 
                                          title={p.chapter}
                                        >
                                          {p.chapter}
                                        </span>
                                        <span style={{ 
                                          fontSize: '0.62rem', 
                                          fontWeight: 800, 
                                          color: pStatusColor,
                                          backgroundColor: pStatusBg,
                                          padding: '0.1rem 0.25rem',
                                          borderRadius: '3px',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0
                                        }}>
                                          {pStatusText}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      const remainingCells = 42 - cells.length;
                      for (let i = 0; i < remainingCells; i++) {
                        cells.push(<div key={`next-empty-${i}`} style={{ height: '95px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }} />);
                      }
                      
                      return cells;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
