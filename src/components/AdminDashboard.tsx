import React, { useState, useEffect } from 'react';
import { 
  getAllStudents, 
  addStudent, 
  deleteStudent, 
  updateStudent,
  getProblem, 
  getDailyProblems,
  deleteProblem,
  getDailyAttendance, 
  setStudentAttendance, 
  getDailySubmissions,
  subscribeOnlineStatuses,
  OnlineStatus,
  getAllProblems,
  getClassAllSubmissions,
  getClassAllAttendances,
  subscribeClassSubmissions,
  getAllClasses,
  addClass,
  deleteClass,
  updateClass
} from '../db';
import { Student, Problem, Submission, Attendance, SchoolClass } from '../types';
import { AdminCreateProblem } from './AdminCreateProblem';
import { AdminAIReport } from './AdminAIReport';
import { useScrollFadeMask } from '../hooks/useScrollFadeMask';

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

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  // 🌟 상단 탭 스마트 페이드 블러 제어 훅
  const { scrollRef: tabScrollRef, fadeMask: tabFadeMask } = useScrollFadeMask();

  // 메인 화면 상태 제어
  const [activeTab, setActiveTab] = useState<'status' | 'students' | 'problems' | 'monthly_grid' | 'classes'>('status');
  const [activeView, setActiveView] = useState<'main' | 'create_problem' | 'ai_report'>('main');
  


  // 날짜 설정
  const getTodayString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [classId, setClassId] = useState('1반'); // 학급 반 관리 상태 신설

  // 데이터 캐시 상태
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySubmissions, setDailySubmissions] = useState<Submission[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<Attendance[]>([]);
  const [dailyProblems, setDailyProblems] = useState<Problem[]>([]); // 오늘 날짜 배포된 전체 문제 세트들
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null); // 현재 모니터링 중인 문제 세트 ID
  const [editProblemId, setEditProblemId] = useState<string | null>(null); // 문제 출제/수정 뷰로 넘길 고유 ID (null이면 신규 출제 모드)
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [problemsList, setProblemsList] = useState<Problem[]>([]); // 배포된 문제 목록
  const [onlineStatuses, setOnlineStatuses] = useState<OnlineStatus[]>([]); // 실시간 온라인 상태 목록

  // 🌟 월간 진도표 관련 신규 상태 추가
  const [monthlyGridDate, setMonthlyGridDate] = useState(new Date());
  const [monthlyProblems, setMonthlyProblems] = useState<Problem[]>([]);
  const [monthlySubmissions, setMonthlySubmissions] = useState<Submission[]>([]);
  const [monthlyAttendances, setMonthlyAttendances] = useState<Attendance[]>([]);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);

  // 🌟 동적 학급 반 개설 관련 신규 상태 추가
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const loadClasses = async () => {
    try {
      const list = await getAllClasses();
      setClassList(list);
      // 만약 현재 선택된 classId가 개설된 반 목록에 없다면 첫 번째 반으로 동기화
      if (list.length > 0 && !list.some(c => c.name === classId)) {
        setClassId(list[0].name);
      }
    } catch (e) {
      console.error('학급 반 목록 로드 실패:', e);
    }
  };

  // 마운트 시 최초 학급 목록 패치 및 첫 번째(맨 위) 반을 디폴트 선택으로 세팅
  useEffect(() => {
    const initDefaultClass = async () => {
      try {
        const list = await getAllClasses();
        setClassList(list);
        if (list.length > 0) {
          setClassId(list[0].name);
        }
      } catch (e) {
        console.error('최초 학급 목록 초기화 실패:', e);
      }
    };
    initDefaultClass();
  }, []);

  // 🌟 실시간 온라인 접속 정보 실시간 구독 리스너 가동 (onSnapshot)
  useEffect(() => {
    const unsubscribe = subscribeOnlineStatuses(classId, (statuses) => {
      setOnlineStatuses(statuses);
    });

    return () => unsubscribe();
  }, [classId, activeView]);

  // 🌟 실시간 학생 과제 제출 상태 구독 리스너 가동 (onSnapshot)
  useEffect(() => {
    const unsubscribe = subscribeClassSubmissions(classId, (allSubs) => {
      const filtered = allSubs.filter(s => s.date === selectedDate);
      setDailySubmissions(filtered);
    });

    return () => unsubscribe();
  }, [classId, selectedDate, activeView]);

  // 선택한 문제 세트 ID 변경 시 모니터링할 activeProblem 동기화
  useEffect(() => {
    if (selectedProblemId && dailyProblems.length > 0) {
      const found = dailyProblems.find((p: Problem) => p.id === selectedProblemId);
      if (found) setActiveProblem(found);
    } else if (dailyProblems.length === 0) {
      setActiveProblem(null);
    }
  }, [selectedProblemId, dailyProblems]);

  // 학생 등록 폼 상태
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');

  // AI 분석 전환 상태
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // 1. 기초 학생 목록 로드
  const loadStudents = async () => {
    try {
      const list = await getAllStudents(classId);
      setStudents(list);
    } catch (e) {
      console.error(e);
    }
  };

  // 2. 선택된 날짜에 따른 학습 및 출결 현황 로드
  const loadDailyStatus = async () => {
    setIsLoading(true);
    try {
      // 복수의 문제 세트 로드 (현재 반에 배포된 문제 세트만)
      const probs = await getDailyProblems(selectedDate, classId);
      setDailyProblems(probs);

      // 선택된 ID가 없거나 유효하지 않으면 첫 번째 문제 세트로 기본값 세팅
      let currentActive = probs[0] || null;
      if (selectedProblemId) {
        const found = probs.find((p: Problem) => p.id === selectedProblemId);
        if (found) {
          currentActive = found;
        } else {
          setSelectedProblemId(currentActive ? currentActive.id : null);
        }
      } else {
        setSelectedProblemId(currentActive ? currentActive.id : null);
      }
      setActiveProblem(currentActive);

      const atts = await getDailyAttendance(selectedDate, classId);
      setDailyAttendance(atts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 배포된 전체 문제 목록 로드
  const loadAllProblems = async () => {
    // db.ts에서 전체 문제 조회가 없는 경우를 위해 헬퍼 구현
    // 로컬 스토리지 또는 Firestore에서 직접 조회
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const isFirebase = !!apiKey && apiKey !== 'YOUR_FIREBASE_API_KEY_HERE';

    let list: Problem[] = [];
    if (isFirebase) {
      try {
        // firebase.ts의 getDocs 사용하여 problems 로드
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const querySnapshot = await getDocs(collection(db, 'problems'));
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Problem);
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      const localData = localStorage.getItem('mock_problems');
      list = localData ? JSON.parse(localData) : [];
    }
    setProblemsList(list.sort((a, b) => b.date.localeCompare(a.date))); // 최신 날짜순
  };

  useEffect(() => {
    loadStudents();
  }, [classId]);

  useEffect(() => {
    if (activeTab === 'status' || activeTab === 'students') {
      loadDailyStatus();
    }
    if (activeTab === 'problems') {
      loadAllProblems();
    }
  }, [selectedDate, activeTab, activeView, classId]);

  // 🌟 월간 진도표 탭 활성화 시 필요한 데이터 일괄 쿼리 로드
  useEffect(() => {
    if (activeTab !== 'monthly_grid') return;

    const loadMonthlyGridData = async () => {
      setIsLoadingMonthly(true);
      try {
        const allProbs = await getAllProblems();
        const year = monthlyGridDate.getFullYear();
        const monthStr = String(monthlyGridDate.getMonth() + 1).padStart(2, '0');
        const prefix = `${year}-${monthStr}`;

        const filteredProbs = allProbs.filter(p => 
          p.date.startsWith(prefix) && 
          (p.targetClasses || ['1반']).includes(classId)
        );
        filteredProbs.sort((a, b) => a.date.localeCompare(b.date));
        setMonthlyProblems(filteredProbs);

        const subs = await getClassAllSubmissions(classId);
        setMonthlySubmissions(subs || []);

        const atts = await getClassAllAttendances(classId);
        setMonthlyAttendances(atts || []);
      } catch (err) {
        console.error('월간 진도표 데이터 로드 실패:', err);
      } finally {
        setIsLoadingMonthly(false);
      }
    };

    loadMonthlyGridData();
  }, [activeTab, monthlyGridDate, classId]);

  // 학생 등록
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId || !newStudentName) {
      alert('번호와 이름을 모두 입력해 주세요.');
      return;
    }

    const formattedId = newStudentId.padStart(2, '0');
    if (students.some(s => s.id === formattedId)) {
      alert('이미 등록된 학생 번호입니다.');
      return;
    }

    try {
      await addStudent({
        id: formattedId,
        classId,
        name: newStudentName.trim()
      });
      setNewStudentId('');
      setNewStudentName('');
      loadStudents();
    } catch (err) {
      console.error(err);
      alert('학생 등록 실패');
    }
  };

  // 학생 이름 수정
  const handleUpdateStudent = async (id: string) => {
    if (!editingStudentName.trim()) return;
    try {
      await updateStudent({ id, classId, name: editingStudentName.trim() });
      setEditingStudentId(null);
      loadStudents();
    } catch (err) {
      console.error(err);
      alert('수정 실패');
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`${id}번 ${name} 학생을 삭제하시겠습니까? 관련 학습 이력이 조회되지 않을 수 있습니다.`)) return;
    try {
      await deleteStudent(classId, id);
      loadStudents();
    } catch (err) {
      console.error(err);
      alert('삭제 실패');
    }
  };

  // 결석 여부 토글 (개별 CRUD)
  const handleAttendanceChange = async (studentId: string, status: 'present' | 'absent_ill' | 'absent_approved') => {
    try {
      await setStudentAttendance(selectedDate, classId, studentId, status);
      loadDailyStatus(); // 출결 다시 로드
    } catch (err) {
      console.error(err);
      alert('출결 저장 실패');
    }
  };

  // 문제 삭제 (개별 CRUD)
  const handleDeleteProblem = async (id: string) => {
    const targetProb = problemsList.find(p => p.id === id);
    const targetDesc = targetProb 
      ? `[${targetProb.date}] ${targetProb.grade} - ${targetProb.chapter} (${targetProb.type})` 
      : id;

    if (!window.confirm(`${targetDesc} 문제를 영구 삭제하시겠습니까?`)) return;
    try {
      await deleteProblem(id);
      loadAllProblems();
      loadDailyStatus(); // 현황판 갱신
    } catch (err) {
      console.error(err);
      alert('문제 삭제 실패');
    }
  };

  // 🌟 학급 반 추가 핸들러
  const handleAddClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetName = newClassName.trim();
    if (!targetName) return;

    if (classList.some(c => c.name === targetName)) {
      alert('이미 존재하는 학급 반 이름입니다.');
      return;
    }

    try {
      await addClass(targetName);
      setNewClassName('');
      loadClasses(); // 목록 갱신
      alert(`[${targetName}]이 정상적으로 개설되었습니다!`);
    } catch (err) {
      console.error(err);
      alert('학급 반 개설에 실패했습니다.');
    }
  };

  // 🌟 학급 반 삭제 핸들러
  const handleDeleteClassClick = async (classIdToDelete: string, classNameToDelete: string) => {
    if (classList.length <= 1) {
      alert('최소 1개의 학급 반은 유지되어야 합니다.');
      return;
    }

    if (!window.confirm(`[${classNameToDelete}]을 삭제하시겠습니까?\n주의: 해당 반 소속 학생 정보나 과제 배포 타겟 목록은 수동으로 정리가 필요합니다.`)) return;

    try {
      await deleteClass(classIdToDelete);
      loadClasses(); // 목록 갱신
      alert(`[${classNameToDelete}]이 삭제되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('학급 반 삭제에 실패했습니다.');
    }
  };

  // 🌟 학급 반 이름 수정 완료 처리 핸들러
  const handleUpdateClass = async (targetClassId: string) => {
    const trimmed = editingClassName.trim();
    if (!trimmed) {
      setEditingClassId(null);
      return;
    }

    // 중복 이름 체크
    if (classList.some((c) => c.id !== targetClassId && c.name === trimmed)) {
      alert('이미 존재하는 학급 반 이름입니다.');
      setEditingClassId(null);
      return;
    }

    try {
      const oldName = targetClassId;
      const newName = trimmed;

      await updateClass(oldName, { name: newName });

      // 대시보드 현재 선택 반 상태값 동기화
      if (classId === oldName) {
        setClassId(newName);
      }

      setEditingClassId(null);
      loadClasses();
      alert(`[${oldName}]의 학생 명단, 출결, 제출 정보가 [${newName}]으로 안전하게 이동되었습니다!`);
    } catch (err) {
      console.error(err);
      alert('학급 이름 수정 및 데이터 이관에 실패했습니다.');
    }
  };

  // 🌟 학급 반 드래그 앤 드롭 정렬 완료 핸들러
  const handleDragDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updatedList = [...classList];
    const [draggedItem] = updatedList.splice(draggedIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);

    // 즉시 시각 렌더링 동기화
    setClassList(updatedList);

    try {
      // 0부터 끝까지 일관성 있는 순서 인덱스로 재부여
      for (let i = 0; i < updatedList.length; i++) {
        await updateClass(updatedList[i].id, { sortOrder: i });
      }
      loadClasses();
    } catch (err) {
      console.error('드래그 앤 드롭 순서 변경 실패:', err);
      alert('순서 변경 도중 오류가 발생했습니다. 다시 시도해 주세요.');
      loadClasses();
    }
  };

  // 특정 학생 클릭 시 AI 리포트 전환
  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setActiveView('ai_report');
  };

  // 서브 뷰가 활성화되어 있을 때 분기 렌더링
  if (activeView === 'create_problem') {
    return (
      <AdminCreateProblem 
        initialDate={selectedDate} 
        initialProblemId={editProblemId} 
        onBack={() => {
          setEditProblemId(null);
          setActiveView('main');
        }} 
      />
    );
  }

  if (activeView === 'ai_report' && selectedStudent) {
    return <AdminAIReport student={selectedStudent} date={selectedDate} onBack={() => setActiveView('main')} />;
  }

  return (
    <div className="app-container">
      {/* 교사용 대시보드 헤더 */}
      <header className="app-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
        <div className="app-logo" style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '1.15rem' }}>
          <div className="logo-dot" style={{ backgroundColor: 'var(--color-point)' }}></div>
          관리자 대시보드
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, marginLeft: 'auto' }}>
          <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 상단 탭 및 설정: 왼쪽 탭들 / 오른쪽 필터 컨트롤 한 줄 배치 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        paddingBottom: '0.25rem'
      }}>
        {/* 왼쪽: 탭 전환 (모바일 가로 스크롤 및 스마트 동적 페이드 블러) */}
        <div 
          ref={tabScrollRef} 
          className={`tab-scroll-container mask-${tabFadeMask}`} 
          style={{ margin: 0, border: 'none', padding: 0, width: 'auto', flex: '0 1 auto' }}
        >
          <button
            className={`btn tab-btn-pill ${activeTab === 'status' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('status')}
          >
            학습 현황판
          </button>
          <button
            className={`btn tab-btn-pill ${activeTab === 'monthly_grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('monthly_grid')}
          >
            월간 진도표
          </button>
          <button
            className={`btn tab-btn-pill ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('students')}
          >
            학생 및 출결 관리
          </button>
          <button
            className={`btn tab-btn-pill ${activeTab === 'problems' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('problems')}
          >
            배포 문제 관리
          </button>
          <button
            className={`btn tab-btn-pill ${activeTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('classes')}
          >
            학급 반 관리
          </button>
        </div>

        {/* 오른쪽: 기준 날짜 & 반 선택 (현황판 및 학생 관리 탭에서만 활성화) */}
        {(activeTab === 'status' || activeTab === 'students') && (
          <div className="admin-filter-bar">
            <div className="admin-filter-item">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block' }}>학급반:</span>
              <select
                className="input-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderRadius: '8px' }}
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                {classList.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="admin-filter-item">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block' }}>기준날짜:</span>
              <input 
                type="date" 
                className="input-control" 
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* 월간 진도표 조작 컨트롤 (월간 진도표 탭에서만 활성화) */}
        {activeTab === 'monthly_grid' && (
          <div className="admin-filter-bar">
            <div className="admin-filter-item">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block' }}>학급반:</span>
              <select
                className="input-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderRadius: '8px' }}
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                {classList.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f4efe6', padding: '0.35rem 0.65rem', borderRadius: '8px', flex: '1 1 auto', justifyContent: 'center' }}>
              <button 
                onClick={() => setMonthlyGridDate(new Date(monthlyGridDate.getFullYear(), monthlyGridDate.getMonth() - 1, 1))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 0.35rem', color: 'var(--text-primary)' }}
              >
                ◀
              </button>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', minWidth: '80px', textAlign: 'center' }}>
                {monthlyGridDate.getFullYear()}년 {monthlyGridDate.getMonth() + 1}월
              </span>
              <button 
                onClick={() => setMonthlyGridDate(new Date(monthlyGridDate.getFullYear(), monthlyGridDate.getMonth() + 1, 1))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 0.35rem', color: 'var(--text-primary)' }}
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 탭 1: 학습 현황판 */}
      {/* ========================================== */}
      {activeTab === 'status' && (() => {
        const totalCount = students.length;
        const absentCount = dailyAttendance.filter(a => a.status !== 'present').length;
        const targetCount = totalCount - absentCount;
        const completedStudentsCount = students.filter(student => {
          const myAtt = dailyAttendance.find(a => a.studentId === student.id);
          if (myAtt && myAtt.status !== 'present') return false;
          // 선택된 문제 세트에 맞는 제출 기록만 필터링
          const isLegacy = activeProblem?.id ? !activeProblem.id.includes('_') : true;
          const mySubs = dailySubmissions.filter(s => {
            if (s.studentId !== student.id) return false;
            return isLegacy ? (s.date === activeProblem?.date) : (s.problemId === activeProblem?.id);
          });
          const completedCount = mySubs.filter(s => s.isCompleted).length;
          const totalQuestions = activeProblem?.questions.length || 0;
          return totalQuestions > 0 && completedCount >= totalQuestions;
        }).length;
        const completionRate = targetCount > 0 ? Math.round((completedStudentsCount / targetCount) * 100) : 0;

        return (
          <div className="bento-grid">
            {/* 🍱 Bento 1: 오늘의 수학 배포 현황 (2-Row Compact Slim Card) */}
            <div className="card col-span-8 card-accent-dark" style={{ 
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem'
            }}>
              {/* Row 1: 배포 상태 뱃지 (왼쪽) & 액션 버튼 (오른쪽) */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '0.5rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-indigo" style={{ margin: 0, padding: '0.35rem 0.75rem' }}>
                    오늘의 수학 배포
                  </span>
                  {dailyProblems.length > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                      총 {dailyProblems.length}건
                    </span>
                  )}
                </div>

                {activeProblem ? (
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => {
                        setEditProblemId(activeProblem.id);
                        setActiveView('create_problem');
                      }} 
                      className="btn"
                      style={{ 
                        fontSize: '0.78rem', 
                        padding: '0.35rem 0.75rem', 
                        backgroundColor: '#ffffff', 
                        color: 'var(--text-primary)', 
                        border: 'none', 
                        borderRadius: '8px',
                        fontWeight: 600,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                    >
                      문제 수정
                    </button>
                    <button 
                      onClick={() => {
                        setEditProblemId(null);
                        setActiveView('create_problem');
                      }} 
                      className="btn btn-point"
                      style={{ 
                        fontSize: '0.78rem', 
                        padding: '0.35rem 0.75rem',
                        fontWeight: 600
                      }}
                    >
                      + 새 문제 추가
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setEditProblemId(null);
                      setActiveView('create_problem');
                    }} 
                    className="btn btn-point"
                    style={{ 
                      fontSize: '0.8rem', 
                      padding: '0.4rem 0.85rem',
                      fontWeight: 600
                    }}
                  >
                    지금 AI로 출제하기
                  </button>
                )}
              </div>

              {/* Row 2: 배포 문제 선택 칩 리스트 (가로 스크롤 및 모바일 최적화) */}
              {dailyProblems.length > 0 ? (
                <div style={{ 
                  display: 'flex', 
                  gap: '0.65rem', 
                  overflowX: 'auto', 
                  paddingBottom: '0.25rem',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none'
                }}>
                  {dailyProblems.map((p) => {
                    const isSelected = selectedProblemId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProblemId(p.id)}
                        style={{
                          flex: '0 0 auto',
                          padding: '0.55rem 0.95rem',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.15)',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.85)' }}>
                          🎓 {p.grade}
                        </span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                          {p.chapter}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255, 255, 255, 0.5)' }}>
                          ({p.questions.length}문항)
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '0.25rem 0' }}>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                    배포된 아침활동 수학 문제가 없습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 🍱 Bento 2: 학급 요약 통계 (2-Row Compact Slim Card, col-span-4) */}
            <div className="card col-span-4 card-accent-violet" style={{ 
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem'
            }}>
              {/* Row 1: 뱃지 (왼쪽) & 재적/결석 텍스트 (오른쪽, 아이콘 제거) */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '0.5rem' 
              }}>
                <span className="badge badge-gray" style={{ margin: 0, padding: '0.35rem 0.75rem' }}>
                  실시간 분석 요약
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  재적 {totalCount}명 · 결석 {absentCount}명
                </span>
              </div>

              {/* Row 2: 완료율 강조 및 완료 인원수 슬림 칩 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                padding: '0.4rem 0'
              }}>
                <div style={{ 
                  fontSize: '1.45rem', 
                  fontWeight: 800, 
                  color: 'var(--color-point)', 
                  lineHeight: 1 
                }}>
                  {completionRate}%
                </div>
                <div style={{ 
                  fontSize: '0.88rem', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap'
                }}>
                  활동 완료 ({completedStudentsCount} / {targetCount}명)
                </div>
              </div>
            </div>

            {/* 🍱 Bento 3: 학생 이행 상황 그리드 보드 (col-span-12) */}
            <div className="card col-span-12">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                학생별 개별 학습 진도판
              </h3>
              
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>진도판 데이터를 불러오고 있습니다...</div>
              ) : students.length === 0 ? (
                <div style={{ textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '3rem 1rem' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    등록된 학생이 없습니다. <strong>'학생 및 출결 관리'</strong> 탭에서 먼저 학생을 등록해 주세요.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4" style={{ gap: '1rem' }}>
                  {students.map((student) => {
                    const status = onlineStatuses.find(o => o.studentId === student.id);
                    // 최근 2분(120,000ms) 이내에 활동 갱신이 있었으면 온라인으로 인정
                    const isOnline = status 
                      ? (Date.now() - new Date(status.lastActiveAt).getTime()) < 120000 
                      : false;

                    const myAtt = dailyAttendance.find(a => a.studentId === student.id);
                    const isStudentAbsent = myAtt && myAtt.status !== 'present';
                    const absentLabel = myAtt?.status === 'absent_ill' ? '결석(질병)' : '결석(출석인정)';

                    // 선택된 문제 세트에 종속된 제출 결과만 필터링
                    const isLegacy = activeProblem?.id ? !activeProblem.id.includes('_') : true;
                    const allMySubs = dailySubmissions.filter(s => {
                      if (s.studentId !== student.id) return false;
                      return isLegacy ? (s.date === activeProblem?.date) : (s.problemId === activeProblem?.id);
                    });
                    // 시작 마커(questionId === 0)는 완료 계산에서 제외
                    const mySubs = allMySubs.filter(s => s.questionId !== 0);
                    // 시작 마커가 있으면 "풀기 시작"했다고 판단
                    const hasStartMarker = allMySubs.some(s => s.questionId === 0);
                    const completedCount = mySubs.filter(s => s.isCompleted).length;
                    const totalQuestions = activeProblem?.questions.length || 0;

                    let statusBadge = <span className="badge badge-gray">미시작</span>;
                    let cardShadow = '0 1px 4px rgba(15, 23, 42, 0.03)';
                    let cardBg = '#ffffff';
                    let cardOpacity = 1;

                    if (isStudentAbsent) {
                      statusBadge = (
                        <span 
                          className="badge" 
                          style={{ 
                            backgroundColor: '#f1f5f9', 
                            color: '#94a3b8', 
                            border: '1px solid #e2e8f0',
                            fontWeight: 500
                          }}
                        >
                          {absentLabel}
                        </span>
                      );
                      cardBg = '#f8fafc';
                      cardShadow = 'none';
                      cardOpacity = 0.55;
                    } else if (totalQuestions > 0) {
                      if (completedCount >= totalQuestions) {
                        statusBadge = <span className="badge badge-green">완료</span>;
                        cardBg = 'rgba(5, 150, 105, 0.08)';
                        cardShadow = '0 1px 4px rgba(5, 150, 105, 0.08)';
                      } else if (mySubs.length > 0 || hasStartMarker) {
                        // 답안 제출이 있거나, 아직 제출은 없으나 풀이창을 연 경우: 일반적인 상태로 표시
                        statusBadge = <span className="badge badge-gray">진행중 ({completedCount}/{totalQuestions})</span>;
                        cardBg = '#ffffff';
                        cardShadow = '0 1px 4px rgba(15, 23, 42, 0.03)';
                      }
                    }

                    return (
                      <div
                        key={student.id}
                        onClick={() => !isStudentAbsent && handleStudentClick(student)}
                        style={{
                          border: 'none',
                          backgroundColor: cardBg,
                          borderRadius: '12px',
                          padding: '0.75rem 1rem',
                          cursor: isStudentAbsent ? 'not-allowed' : 'pointer',
                          boxShadow: cardShadow,
                          opacity: cardOpacity,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* 왼쪽: 인디케이터 - 번호 - 이름 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
                          {!isStudentAbsent && (
                            <span 
                              title={isOnline ? '현재 로그인 접속 중 (온라인)' : '접속 종료 또는 미접속 (오프라인)'}
                              style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isOnline ? '#10b981' : '#cbd5e1',
                                flexShrink: 0
                              }}
                            />
                          )}
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {String(student.id).padStart(2, '0')}번
                          </span>
                          <span style={{ 
                            fontSize: '0.95rem', 
                            fontWeight: 700, 
                            color: isStudentAbsent ? 'var(--text-muted)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {student.name}
                          </span>
                        </div>

                        {/* 오른쪽: 완료 여부 상태 뱃지 */}
                        <div style={{ flexShrink: 0 }}>
                          {statusBadge}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================== */}
      {/* 탭 2: 학생 및 출결 관리 */}
      {/* ========================================== */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-2" style={{ gap: '2rem', alignItems: 'start' }}>
          {/* 왼쪽: 학생 신규 등록 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
              신규 학생 등록
              <InfoTooltip text="우리 반에 새로운 학생 번호와 이름을 입력하여 추가합니다." />
            </h3>
            <form onSubmit={handleAddStudent}>
              <div className="form-group">
                <label className="form-label">학급 번호</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  placeholder="예: 7" 
                  className="input-control"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">학생 이름</label>
                <input 
                  type="text" 
                  placeholder="예: 홍길동" 
                  className="input-control"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                학생 등록하기
              </button>
            </form>
          </div>

          {/* 오른쪽: 학생 목록 및 출결(결석) 토글 설정 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
              우리 반 출결 및 관리
              <InfoTooltip text={`선택된 날짜(${selectedDate}) 기준 결석 학생을 체크하거나 정보를 수정할 수 있습니다.`} />
            </h3>

            <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', backgroundColor: '#fcfaf6' }}>
                    <th style={{ padding: '0.6rem 0.4rem', width: '55px', whiteSpace: 'nowrap' }}>번호</th>
                    <th style={{ padding: '0.6rem 0.4rem', width: '80px', whiteSpace: 'nowrap' }}>이름</th>
                    <th style={{ padding: '0.6rem 0.4rem' }}>출결 설정 ({selectedDate})</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: '50px', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    // 해당 학생의 당일 출결 상태 찾기
                    const myAtt = dailyAttendance.find(a => a.studentId === student.id);
                    const currentStatus = myAtt ? myAtt.status : 'present';

                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600, width: '55px', whiteSpace: 'nowrap' }}>
                          {student.id}번
                        </td>
                        <td style={{ padding: '0.6rem 0.4rem', width: '80px', whiteSpace: 'nowrap' }}>
                          {editingStudentId === student.id ? (
                            <input
                              type="text"
                              className="input-control"
                              style={{
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.85rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                display: 'block'
                              }}
                              value={editingStudentName}
                              onChange={(e) => setEditingStudentName(e.target.value)}
                              onBlur={() => handleUpdateStudent(student.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateStudent(student.id);
                                if (e.key === 'Escape') setEditingStudentId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span 
                              style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
                              title="클릭하여 이름 수정"
                              onClick={() => {
                                setEditingStudentId(student.id);
                                setEditingStudentName(student.name);
                              }}
                            >
                              {student.name}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem 0.4rem' }}>
                          <select
                            className="input-control"
                            style={{ 
                              padding: '0.3rem 0.5rem', 
                              fontSize: '0.82rem',
                              width: '100%',
                              boxSizing: 'border-box',
                              borderColor: currentStatus !== 'present' ? '#d97706' : 'var(--border-color)',
                              color: currentStatus !== 'present' ? '#d97706' : 'var(--text-primary)',
                              fontWeight: currentStatus !== 'present' ? 600 : 400
                            }}
                            value={currentStatus}
                            onChange={(e) => handleAttendanceChange(
                              student.id, 
                              e.target.value as 'present' | 'absent_ill' | 'absent_approved'
                            )}
                          >
                            <option value="present">출석 (기본)</option>
                            <option value="absent_ill">질병 결석</option>
                            <option value="absent_approved">출석인정 결석</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', width: '50px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer', 
                              fontSize: '0.8rem', 
                              color: 'var(--color-error)',
                              padding: '0.2rem 0.4rem',
                              fontWeight: 500
                            }}
                            title="학생 삭제"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 2: 월간 진도표 */}
      {/* ========================================== */}
      {activeTab === 'monthly_grid' && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              월간 학급 진도 현황표
            </h2>
            <InfoTooltip text="선택한 월에 문제가 배포된 날짜별로 모든 학생들의 아침활동 학습 완료 여부를 한눈에 조회합니다." />
          </div>

          {isLoadingMonthly ? (
            <div style={{ textAlign: 'center', padding: '5rem' }}>월간 진도 현황 데이터를 불러오는 중...</div>
          ) : monthlyProblems.length === 0 ? (
            <div style={{
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '4rem 1.5rem',
              textAlign: 'center'
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>선택한 월에 배포된 아침활동 수학 과제가 없습니다.</p>
            </div>
          ) : (
            <div className="table-responsive table-wide-scroll" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-bento)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '110px', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 2 }}>
                      학생 명단
                    </th>
                    {monthlyProblems.map((prob) => {
                      const displayDate = prob.date.substring(5).replace('-', '/');
                      return (
                        <th key={prob.id} style={{ padding: '1rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '100px', textAlign: 'center' }}>
                          <div>{displayDate}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.15rem' }}>
                            {prob.chapter.substring(0, 6)}...
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ 
                          padding: '0.75rem', 
                          fontWeight: 600, 
                          color: 'var(--text-primary)', 
                          position: 'sticky', 
                          left: 0, 
                          backgroundColor: '#ffffff', 
                          zIndex: 1, 
                          borderRight: '1px solid var(--border-color)' 
                        }}>
                          {student.id}번 {student.name}
                        </td>
                        {monthlyProblems.map((prob) => {
                          const att = monthlyAttendances.find(a => a.date === prob.date && a.studentId === student.id);
                          const isAbsent = att && att.status !== 'present';
                          
                          const studentSubs = monthlySubmissions.filter(s => s.problemId === prob.id && s.studentId === student.id && s.questionId !== 0);
                          const completedCount = studentSubs.filter(s => s.isCompleted).length;
                          const totalQuestions = prob.questions.length;
                          const hasAttempts = studentSubs.length > 0;
                          
                          let label = '미시작';
                          
                          if (isAbsent) {
                            label = att.status === 'absent_ill' ? '결석(질병)' : '결석(인정)';
                          } else if (completedCount >= totalQuestions && totalQuestions > 0) {
                            label = '완료';
                          } else if (hasAttempts || completedCount > 0) {
                            label = '진행중';
                          }
                          
                          const customStyle: React.CSSProperties = {
                            display: 'inline-block',
                            width: '100%',
                            textAlign: 'center',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            fontWeight: 700
                          };
                          
                          let bg = '#f1f5f9';
                          let text = '#64748b';
                          let border = '1px solid #cbd5e1';
                          
                          if (label.startsWith('결석')) {
                            bg = '#fffbeb';
                            text = '#d97706';
                            border = '1px solid #fde68a';
                          } else if (label === '완료') {
                            bg = 'rgba(16, 185, 129, 0.08)';
                            text = 'var(--color-success)';
                            border = '1px solid rgba(16, 185, 129, 0.2)';
                          } else if (label === '진행중') {
                            bg = 'rgba(6, 78, 59, 0.08)';
                            text = 'var(--color-point)';
                            border = '1px solid rgba(6, 78, 59, 0.2)';
                          }

                          return (
                            <td key={prob.id} style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                              <span style={{ ...customStyle, backgroundColor: bg, color: text, border: border }}>
                                {label}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 3: 배포 문제 관리 */}
      {/* ========================================== */}
      {activeTab === 'problems' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>배포된 아침활동 목록</h3>
            <button 
              onClick={() => {
                setEditProblemId(null);
                setActiveView('create_problem');
              }} 
              className="btn btn-primary btn-point"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              문제 생성 & 배포
            </button>
          </div>

          {problemsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>아직 배포된 수학 문제가 없습니다.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>배포 예정일</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>학년/단원</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>문제 수</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>문제 유형</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {problemsList.map((prob) => (
                    <tr key={prob.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{prob.date}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{prob.grade} - {prob.chapter}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}><strong>{prob.questions.length}문제</strong></td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span className="badge badge-gray">{prob.type}</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedDate(prob.date);
                            setEditProblemId(prob.id);
                            setActiveView('create_problem');
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          수정/조회
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(prob.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 5: 학급 반 관리 (신설) */}
      {/* ========================================== */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-2" style={{ gap: '2rem', alignItems: 'start' }}>
          {/* ① 신규 학급 반 개설 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
              신규 학급 반 개설
              <InfoTooltip text={
                <div>
                  새로 개설된 반은 즉시 학생 로그인창과 문제 배포창에 반영됩니다.<br />
                  (예: "6학년 1반" 또는 "기초학력 2반")
                </div>
              } />
            </h3>
            <form onSubmit={handleAddClassSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">학년 반 명칭</label>
                <input 
                  type="text" 
                  placeholder="예: 6학년 1반, 기초수학반" 
                  className="input-control"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                새 학년반 개설하기
              </button>
            </form>
          </div>

          {/* ② 개설된 학급 반 목록 및 삭제 */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
              개설 학급 목록
              <InfoTooltip text="현재 우리 학교 아침활동에 개설되어 가동 중인 학급 반 목록입니다." />
            </h3>

            <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', backgroundColor: '#fcfaf6' }}>
                    <th style={{ padding: '0.6rem 0.35rem', width: '36px', textAlign: 'center' }}></th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>학급 반 이름</th>
                    <th style={{ padding: '0.6rem 0.35rem', textAlign: 'center', width: '60px', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {classList.map((c, index) => {
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;

                    return (
                      <tr 
                        key={c.id} 
                        draggable
                        onDragStart={(e) => {
                          setDraggedIndex(index);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverIndex !== index) {
                            setDragOverIndex(index);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDrop={() => handleDragDrop(index)}
                        style={{ 
                          borderBottom: isDragOver ? '2px solid var(--color-point)' : '1px solid var(--border-color)',
                          backgroundColor: isDragging ? 'rgba(6, 78, 59, 0.04)' : isDragOver ? 'rgba(0,0,0,0.01)' : '#ffffff',
                          opacity: isDragging ? 0.6 : 1,
                          transition: 'background-color 0.15s ease, border-bottom 0.15s ease'
                        }}
                      >
                        {/* ① 드래그 핸들 */}
                        <td 
                          style={{ 
                            padding: '0.6rem 0.35rem', 
                            width: '36px', 
                            textAlign: 'center', 
                            cursor: 'grab', 
                            color: 'var(--text-muted)', 
                            userSelect: 'none', 
                            fontSize: '1rem' 
                          }}
                          title="드래그하여 순서 조정"
                        >
                          ☰
                        </td>

                        {/* ② 학급 반 명칭 */}
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, verticalAlign: 'middle' }}>
                          <div style={{ minHeight: '36px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
                            {editingClassId === c.id ? (
                              <input
                                type="text"
                                className="input-control"
                                style={{
                                  padding: '0 0.4rem',
                                  margin: 0,
                                  fontSize: '0.88rem',
                                  fontWeight: 600,
                                  height: '28px',
                                  lineHeight: '28px',
                                  boxSizing: 'border-box',
                                  border: '1px solid var(--color-point)',
                                  borderRadius: '4px',
                                  width: '100%',
                                  display: 'block'
                                }}
                                value={editingClassName}
                                onChange={(e) => setEditingClassName(e.target.value)}
                                onBlur={() => handleUpdateClass(c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateClass(c.id);
                                  if (e.key === 'Escape') setEditingClassId(null);
                                }}
                                autoFocus
                              />
                            ) : (
                              <span 
                                style={{ cursor: 'pointer', textDecoration: 'underline', display: 'inline-block', lineHeight: '1.2' }}
                                title="클릭하여 반 이름 수정"
                                onClick={() => {
                                  setEditingClassId(c.id);
                                  setEditingClassName(c.name);
                                }}
                              >
                                {c.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ③ 삭제 버튼 */}
                        <td style={{ padding: '0.4rem 0.35rem', textAlign: 'center', width: '60px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleDeleteClassClick(c.id, c.name)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.2rem 0.45rem', 
                              fontSize: '0.78rem', 
                              color: 'var(--color-error)', 
                              borderColor: 'rgba(239, 68, 68, 0.3)' 
                            }}
                            title="학급 삭제"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
