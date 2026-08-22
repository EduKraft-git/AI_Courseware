import React, { useState, useEffect } from 'react';
import { 
  getDailyProblems, 
  subscribeDailyProblems,
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
import { useScrollFadeMask } from '../hooks/useScrollFadeMask';

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

// ℹ️ 타이틀 옆 미니 인포메이션 툴팁 팝오버 컴포넌트
const InfoTooltip: React.FC<{ text: React.ReactNode }> = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span 
      className="info-tooltip-wrapper"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onBlur={() => setIsOpen(false)}
        aria-label="안내 도움말"
      >
        i
      </button>
      {isOpen && (
        <div className="info-tooltip-popover">
          {text}
        </div>
      )}
    </span>
  );
};

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onLogout,
  onStartSolve,
}) => {
  // 🌟 상단 탭 스마트 동적 페이드 블러 훅
  const { scrollRef: tabScrollRef, fadeMask: tabFadeMask } = useScrollFadeMask();

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

  // 🌟 오늘의 배포 문제 및 출결 실시간 감지 (새 문제 배포 시 0.1초 즉시 화면 반영)
  useEffect(() => {
    setIsLoading(true);

    // 1. 출결(결석) 현황 검사
    const checkAttendance = async () => {
      try {
        const dailyAttendance = await getDailyAttendance(todayStr, student.classId);
        const myAttendance = dailyAttendance.find(a => a.studentId === student.id);
        if (myAttendance && myAttendance.status !== 'present') {
          setIsAbsent(true);
          setAbsentReason(
            myAttendance.status === 'absent_ill' ? '질병 결석' : '출석 인정 결석'
          );
        } else {
          setIsAbsent(false);
          setAbsentReason('');
        }
      } catch (e) {
        console.error('출결 로드 에러:', e);
      }
    };
    checkAttendance();

    // 2. 오늘의 문제 세트 실시간 구독 리스너 가동 (선생님이 배포하는 즉시 0.1초 자동 갱신!)
    const unsubscribeProblems = subscribeDailyProblems(todayStr, student.classId, async (problems) => {
      try {
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

        // 밀린 학습(미완료 학습) 문제 세트 목록도 함께 실시간 갱신
        const unfinished = await getUnfinishedProblems(student.classId, student.id, todayStr);
        setPendingProblems(unfinished);
      } catch (e) {
        console.error('실시간 문제 처리 에러:', e);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeProblems();
    };
  }, [student.id, student.classId, todayStr]);

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

      {/* 🌟 탭 네비게이션(왼쪽) & 오늘 날짜(오른쪽) 한 줄 배치 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        {/* 왼쪽: 탭 네비게이션 (스마트 동적 스크롤 페이드 블러) */}
        <div ref={tabScrollRef} className={`tab-scroll-container mask-${tabFadeMask}`} style={{ margin: 0, width: 'auto' }}>
          {/* 오늘의 아침활동 탭 (미완료 과제가 있을 시 빨간 원 뱃지로 개수 표시) */}
          <button
            className={`btn tab-btn-pill ${activeTab === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('today')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            오늘의 아침활동
            {(() => {
              const todayUnfinishedCount = todayProblems.filter(p => !p.isCompleted).length;
              if (todayUnfinishedCount > 0 && !isAbsent) {
                return (
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
                    {todayUnfinishedCount}
                  </span>
                );
              }
              return null;
            })()}
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

        {/* 오른쪽: 오늘 날짜 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="badge badge-indigo" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}>
            오늘 날짜: {todayStr}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>데이터를 불러오는 중입니다...</div>
      ) : (
        <div>
          {/* 오늘의 아침활동 탭 */}
          {activeTab === 'today' && (
            <div className="card" style={{ padding: '2rem' }}>
              {isAbsent ? (
                // 결석 안내 화면
                <div style={{
                  backgroundColor: '#fffbeb',
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
                  padding: '4rem 1.5rem',
                  textAlign: 'center'
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    아직 선생님이 배포하신 오늘의 수학 문제가 없습니다.<br />
                    잠시 기다린 후 새로고침하거나 대기해 주세요.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 밀린 학습 탭 */}
          {activeTab === 'pending' && (
            <div className="card" style={{ padding: '2rem' }}>
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
                  padding: '4rem 1.5rem',
                  textAlign: 'center'
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    밀린 학습이 하나도 없습니다!<br />
                    아주 성실하게 완료하셨네요. 참 잘했어요!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 학습 달력 탭 */}
          {activeTab === 'calendar' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>학습 달력</h2>
                  <InfoTooltip text="매일의 아침활동 달성 상태와 출결 이력을 확인할 수 있습니다." />
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
                  {/* 달력 요일 헤더 (7열 균등 고정) */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', 
                    gap: '0.25rem', 
                    textAlign: 'center', 
                    fontWeight: 700, 
                    fontSize: '0.8rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '0.5rem' 
                  }}>
                    <div style={{ color: '#ef4444' }}>일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div style={{ color: 'var(--color-point)' }}>토</div>
                  </div>

                  {/* 달력 일자 그리드 (7열 완전 균등 고정 lock) */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', 
                    gap: '0.25rem' 
                  }}>
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
                        cells.push(
                          <div 
                            key={`empty-${i}`} 
                            style={{ 
                              minHeight: '75px', 
                              backgroundColor: '#f5f0e8', 
                              borderRadius: '8px', 
                              opacity: 0.5,
                              minWidth: 0
                            }} 
                          />
                        );
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
                        let statusText = '';
                        let statusColor = 'var(--text-secondary)';
                        
                        if (isAbsentOnDate) {
                          cellBg = '#fffbeb';
                          statusText = absentLabel;
                          statusColor = '#d97706';
                        } else if (hasProblems) {
                          if (allDone) {
                            cellBg = 'rgba(5, 150, 105, 0.06)';
                            statusText = '완료';
                            statusColor = 'var(--color-success)';
                          } else if (anyAttempt) {
                            cellBg = 'rgba(6, 78, 59, 0.05)';
                            statusText = '진행중';
                            statusColor = 'var(--color-point)';
                          } else {
                            cellBg = 'rgba(225, 29, 72, 0.04)';
                            statusText = '미달성';
                            statusColor = 'var(--color-error)';
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
                              borderRadius: '8px', 
                              padding: '0.35rem 0.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
                              minWidth: 0,
                              overflow: 'hidden'
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: dayNumColor }}>
                              {day}
                            </span>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden', minWidth: 0, width: '100%' }}>
                              {isAbsentOnDate ? (
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  fontWeight: 800, 
                                  color: statusColor,
                                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                                  padding: '0.15rem 0.25rem',
                                  borderRadius: '4px',
                                  textAlign: 'center',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {statusText}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden', minWidth: 0, width: '100%' }}>
                                  {dateProblems.map((p) => {
                                    const pSubs = calendarSubmissions.filter(s => s.problemId === p.id && s.questionId !== 0);
                                    const pCompletedCount = pSubs.filter(s => s.isCompleted).length;
                                    const pTotalCount = p.questions.length;
                                    const pAnyAttempt = pSubs.length > 0;
                                    const pIsDone = pCompletedCount >= pTotalCount && pTotalCount > 0;
                                    
                                    const pStatusText = pIsDone ? '완료' : pAnyAttempt ? '진행' : '미작';
                                    const pStatusColor = pIsDone ? 'var(--color-success)' : pAnyAttempt ? 'var(--color-point)' : '#6b7280';
                                    const pStatusBg = pIsDone ? 'rgba(16, 185, 129, 0.08)' : pAnyAttempt ? 'rgba(6, 78, 59, 0.08)' : '#f3f4f6';

                                    return (
                                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.15rem', minWidth: 0, width: '100%' }}>
                                        <span 
                                          style={{ 
                                            fontSize: '0.62rem', 
                                            color: 'var(--text-muted)', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap', 
                                            fontWeight: 600,
                                            flex: 1,
                                            minWidth: 0
                                          }} 
                                          title={p.chapter}
                                        >
                                          {p.chapter}
                                        </span>
                                        <span style={{ 
                                          fontSize: '0.6rem', 
                                          fontWeight: 800, 
                                          color: pStatusColor,
                                          backgroundColor: pStatusBg,
                                          padding: '0.1rem 0.2rem',
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
                        cells.push(
                          <div 
                            key={`next-empty-${i}`} 
                            style={{ 
                              minHeight: '75px', 
                              backgroundColor: '#f5f0e8', 
                              borderRadius: '8px', 
                              opacity: 0.5,
                              minWidth: 0
                            }} 
                          />
                        );
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
