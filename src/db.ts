import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { getActiveDb } from './firebase';
import { loadAppConfig } from './config/appConfig';
import { Student, Problem, Submission, Attendance, SubmissionAttempt, SchoolClass } from './types';

// Firebase 연동이 활성화되어 있는지 판단하는 헬퍼 함수
// 환경변수 또는 사용자 커스텀 설정(localStorage)에 유효한 Firebase 설정이 있는지 확인합니다.
export const isFirebaseActive = (): boolean => {
  const config = loadAppConfig();
  return !!(config.firebaseConfig && config.firebaseConfig.apiKey && config.firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY_HERE');
};

// 🌟 런타임에 동적으로 변경되는 Firestore DB 인스턴스를 항상 안전하게 참조하는 헬퍼
const getDb = () => getActiveDb();

// ==========================================
// 1. 학생(Students) CRUD
// ==========================================

// 모든 학생 조회 (classId 기준 필터링 지원, 번호 기준 오름차순 정렬)
export const getAllStudents = async (classId?: string): Promise<Student[]> => {
  if (isFirebaseActive()) {
    try {
      let q = query(collection(getDb(), 'students'));
      if (classId) {
        q = query(collection(getDb(), 'students'), where('classId', '==', classId));
      }
      const querySnapshot = await getDocs(q);
      const students: Student[] = [];
      querySnapshot.forEach((doc) => {
        students.push({ id: doc.data().id, ...doc.data() } as Student);
      });
      return students.sort((a, b) => Number(a.id) - Number(b.id));
    } catch (e) {
      console.error('Firebase DB 에러 (학생 목록 조회)', e);
      return [];
    }
  }
  
  // 로컬 스토리지 데모 모드
  const localData = localStorage.getItem('mock_students');
  const students: Student[] = localData ? JSON.parse(localData) : [];
  const filtered = classId ? students.filter(s => s.classId === classId) : students;
  return filtered.sort((a, b) => Number(a.id) - Number(b.id));
};

// 학생 추가 (classId_번호가 Firestore 고유 문서 키가 됩니다)
export const addStudent = async (student: Student): Promise<void> => {
  const docId = `${student.classId}_${student.id}`;
  if (isFirebaseActive()) {
    try {
      await setDoc(doc(getDb(), 'students', docId), {
        id: student.id,
        classId: student.classId,
        name: student.name,
        createdAt: new Date().toISOString()
      });
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학생 추가)', e);
      throw e;
    }
  }

  // 로컬 스토리지 데모 모드
  const students = await getAllStudents();
  if (students.some(s => s.id === student.id && s.classId === student.classId)) {
    throw new Error('이미 이 학급에 등록된 번호입니다.');
  }
  students.push({ ...student, createdAt: new Date().toISOString() });
  localStorage.setItem('mock_students', JSON.stringify(students));
};

// 학생 수정
export const updateStudent = async (student: Student): Promise<void> => {
  const docId = `${student.classId}_${student.id}`;
  if (isFirebaseActive()) {
    try {
      await updateDoc(doc(getDb(), 'students', docId), {
        name: student.name
      });
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학생 수정)', e);
      throw e;
    }
  }

  // 로컬 스토리지 데모 모드
  const students = await getAllStudents();
  const index = students.findIndex(s => s.id === student.id && s.classId === student.classId);
  if (index !== -1) {
    students[index].name = student.name;
    localStorage.setItem('mock_students', JSON.stringify(students));
  }
};

// 학생 삭제 (고아 데이터 방지를 위해 관련 제출 기록, 출결, 리포트, 온라인 상태 일괄 정리)
export const deleteStudent = async (classId: string, id: string): Promise<void> => {
  const docId = `${classId}_${id}`;
  if (isFirebaseActive()) {
    try {
      const batch = writeBatch(getDb());

      // 1. 학생 기본 문서 삭제
      batch.delete(doc(getDb(), 'students', docId));

      // 2. 온라인 상태 및 종합 리포트 문서 삭제
      batch.delete(doc(getDb(), 'online_status', docId));
      batch.delete(doc(getDb(), 'comprehensive_reports', docId));

      // 3. 학생의 제출 기록(submissions) 쿼리 후 삭제
      const subSnap = await getDocs(query(
        collection(getDb(), 'submissions'),
        where('classId', '==', classId),
        where('studentId', '==', id)
      ));
      subSnap.forEach(d => batch.delete(d.ref));

      // 4. 학생의 출결 기록(attendance) 쿼리 후 삭제
      const attSnap = await getDocs(query(
        collection(getDb(), 'attendance'),
        where('classId', '==', classId),
        where('studentId', '==', id)
      ));
      attSnap.forEach(d => batch.delete(d.ref));

      await batch.commit();
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학생 및 관련 데이터 일괄 삭제)', e);
      throw e;
    }
  }

  // 로컬 스토리지 데모 모드
  let students = await getAllStudents();
  students = students.filter(s => !(s.id === id && s.classId === classId));
  localStorage.setItem('mock_students', JSON.stringify(students));

  const localSubs = localStorage.getItem('mock_submissions');
  if (localSubs) {
    const subs: Submission[] = JSON.parse(localSubs);
    localStorage.setItem('mock_submissions', JSON.stringify(subs.filter(s => !(s.classId === classId && s.studentId === id))));
  }

  const localAtt = localStorage.getItem('mock_attendance');
  if (localAtt) {
    const atts: Attendance[] = JSON.parse(localAtt);
    localStorage.setItem('mock_attendance', JSON.stringify(atts.filter(a => !(a.classId === classId && a.studentId === id))));
  }

  const localOnline = localStorage.getItem('mock_online_status');
  if (localOnline) {
    const onlineList: any[] = JSON.parse(localOnline);
    localStorage.setItem('mock_online_status', JSON.stringify(onlineList.filter(o => o.id !== docId)));
  }

  const localReports = localStorage.getItem('mock_comprehensive_reports');
  if (localReports) {
    const reports: any[] = JSON.parse(localReports);
    localStorage.setItem('mock_comprehensive_reports', JSON.stringify(reports.filter(r => r.id !== docId)));
  }
};

// ==========================================
// 2. 아침활동 문제(Problems) CRUD
// ==========================================

// 특정 날짜 또는 고유 ID의 문제 조회
export const getProblem = async (id: string): Promise<Problem | null> => {
  if (isFirebaseActive()) {
    try {
      const docRef = doc(getDb(), 'problems', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Problem;
      }
      
      // 하위 호환성 및 날짜 문자열로 조회를 시도했을 경우 쿼리로 대응
      if (id.length === 10 && id.includes('-')) {
        const q = query(collection(getDb(), 'problems'), where('date', '==', id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const firstDoc = querySnapshot.docs[0];
          return { id: firstDoc.id, ...firstDoc.data() } as Problem;
        }
      }
      return null;
    } catch (e) {
      console.error('Firebase DB 에러 (문제 조회)', e);
      return null;
    }
  }

  // 로컬 스토리지 데모 모드
  const localData = localStorage.getItem('mock_problems');
  const problems: Problem[] = localData ? JSON.parse(localData) : [];
  const found = problems.find(p => p.id === id) || problems.find(p => p.date === id);
  return found || null;
};

// 특정 날짜에 배포된 모든 문제 꾸러미(유형들) 목록 조회 (학급 반 필터링 지원)
export const getDailyProblems = async (date: string, classId?: string): Promise<Problem[]> => {
  if (isFirebaseActive()) {
    try {
      const q = query(collection(getDb(), 'problems'), where('date', '==', date));
      const querySnapshot = await getDocs(q);
      const list: Problem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Problem, 'id'>;
        const isTarget = !classId || !data.targetClasses || data.targetClasses.length === 0 || data.targetClasses.includes(classId);
        if (isTarget) {
          list.push({ id: doc.id, ...data } as Problem);
        }
      });
      return list;
    } catch (e) {
      console.error('Firebase DB 에러 (일일 문제 조회)', e);
      return [];
    }
  }

  // 로컬 스토리지 데모 모드
  const localData = localStorage.getItem('mock_problems');
  const problems: Problem[] = localData ? JSON.parse(localData) : [];
  const daily = problems.filter(p => p.date === date);
  return classId 
    ? daily.filter(p => !p.targetClasses || p.targetClasses.length === 0 || p.targetClasses.includes(classId)) 
    : daily;
};

// 🌟 특정 날짜의 배포 문제 실시간 구독 (새 문제 배포/수정/삭제 시 로그인된 학생 화면에 0.1초 즉시 동기화)
export const subscribeDailyProblems = (
  date: string,
  classId: string | undefined,
  callback: (problems: Problem[]) => void
): (() => void) => {
  if (isFirebaseActive()) {
    try {
      const q = query(collection(getDb(), 'problems'), where('date', '==', date));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const list: Problem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Problem, 'id'>;
          const isTarget = !classId || !data.targetClasses || data.targetClasses.length === 0 || data.targetClasses.includes(classId);
          if (isTarget) {
            list.push({ id: doc.id, ...data } as Problem);
          }
        });
        callback(list);
      }, (error) => {
        console.error('실시간 문제 구독 에러:', error);
      });
      return unsubscribe;
    } catch (e) {
      console.error('Firebase DB 실시간 구독 에러', e);
    }
  }

  // 로컬 스토리지 백업 모드 (초기 1회 호출)
  const localData = localStorage.getItem('mock_problems');
  const problems: Problem[] = localData ? JSON.parse(localData) : [];
  const daily = problems.filter(p => p.date === date);
  const filtered = classId 
    ? daily.filter(p => !p.targetClasses || p.targetClasses.length === 0 || p.targetClasses.includes(classId)) 
    : daily;
  callback(filtered);
  return () => {};
};

// 문제 배포 및 수정 (고유 ID 또는 날짜가 ID가 됩니다)
export const saveProblem = async (problem: Problem): Promise<void> => {
  const docId = problem.id || `${problem.date}_${Date.now()}`;
  problem.id = docId;

  // 💡 Firestore는 undefined 필드가 포함된 데이터를 거부하므로 JSON 직렬화를 통해 완벽 정제
  const payload = JSON.parse(JSON.stringify({
    id: docId,
    date: problem.date,
    grade: problem.grade,
    chapter: problem.chapter,
    type: problem.type,
    questions: problem.questions,
    targetClasses: problem.targetClasses && problem.targetClasses.length > 0 ? problem.targetClasses : ['1반']
  }));

  if (isFirebaseActive()) {
    try {
      await setDoc(doc(getDb(), 'problems', docId), payload);
      return;
    } catch (e: any) {
      console.error('Firebase DB 문제 저장 실패:', e);
      throw new Error(`Firebase 클라우드에 문제를 저장하지 못했습니다: ${e?.message || e}`);
    }
  }

  // 로컬 스토리지 백업
  const localData = localStorage.getItem('mock_problems');
  let problems: Problem[] = localData ? JSON.parse(localData) : [];
  problems = problems.filter(p => p.id !== docId); // 고유 ID 기준으로 중복 필터링
  problems.push(problem);
  localStorage.setItem('mock_problems', JSON.stringify(problems));
};

// 문제 삭제 (ID 기준) 및 관련 학생 제출 이력 일괄 연쇄 삭제 (Cascade Delete)
export const deleteProblem = async (id: string): Promise<void> => {
  if (isFirebaseActive()) {
    try {
      // 1. 배포된 문제 세트 파괴
      await deleteDoc(doc(getDb(), 'problems', id));
      
      // 2. 연관된 학생들의 모든 제출 기록(submissions) 일괄 조회 후 완전 파괴
      const qSubmissions = query(
        collection(getDb(), 'submissions'),
        where('problemId', '==', id)
      );
      const subSnapshot = await getDocs(qSubmissions);
      const deletePromises: Promise<void>[] = [];
      subSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletePromises);
      
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (연관 제출 이력 삭제 오류)', e);
    }
  }

  // 로컬 스토리지 백업 모드
  // 1. 문제 정보 삭제
  const localData = localStorage.getItem('mock_problems');
  let problems: Problem[] = localData ? JSON.parse(localData) : [];
  problems = problems.filter(p => p.id !== id && p.date !== id);
  localStorage.setItem('mock_problems', JSON.stringify(problems));

  // 2. 연관된 제출 데이터 삭제
  const localSubs = localStorage.getItem('mock_submissions');
  if (localSubs) {
    let submissions: any[] = JSON.parse(localSubs);
    submissions = submissions.filter(s => s.problemId !== id);
    localStorage.setItem('mock_submissions', JSON.stringify(submissions));
  }
};

// ==========================================
// 3. 출결(Attendance) CRUD
// ==========================================

// 특정 날짜의 결석 현황 전체 조회 (classId 기준 필터링 지원)
export const getDailyAttendance = async (date: string, classId?: string): Promise<Attendance[]> => {
  if (isFirebaseActive()) {
    try {
      let q = query(collection(getDb(), 'attendance'), where('date', '==', date));
      if (classId) {
        q = query(collection(getDb(), 'attendance'), where('date', '==', date), where('classId', '==', classId));
      }
      const querySnapshot = await getDocs(q);
      const attendances: Attendance[] = [];
      querySnapshot.forEach((doc) => {
        attendances.push({ id: doc.id, ...doc.data() } as Attendance);
      });
      return attendances;
    } catch (e) {
      console.error('Firebase DB 에러 (출결 조회)', e);
      return [];
    }
  }

  // 로컬 스토리지 데모 모드
  const localData = localStorage.getItem('mock_attendance');
  const attendances: Attendance[] = localData ? JSON.parse(localData) : [];
  const daily = attendances.filter(a => a.date === date);
  return classId ? daily.filter(a => a.classId === classId) : daily;
};

// 학생 결석 상태 변경 (date_classId_studentId 가 ID)
export const setStudentAttendance = async (
  date: string, 
  classId: string,
  studentId: string, 
  status: 'present' | 'absent_ill' | 'absent_approved' | 'exempt'
): Promise<void> => {
  const docId = `${date}_${classId}_${studentId}`;
  if (isFirebaseActive()) {
    try {
      if (status === 'present') {
        // 출석이면 결석 기록 문서 자체를 제거
        await deleteDoc(doc(getDb(), 'attendance', docId));
      } else {
        await setDoc(doc(getDb(), 'attendance', docId), {
          date,
          classId,
          studentId,
          status
        });
      }
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (출결 설정)', e);
      throw e;
    }
  }

  // 로컬 스토리지 백업
  const localData = localStorage.getItem('mock_attendance');
  let attendances: Attendance[] = localData ? JSON.parse(localData) : [];
  attendances = attendances.filter(a => a.id !== docId); // 기존 값 제거

  if (status !== 'present') {
    attendances.push({
      id: docId,
      date,
      classId,
      studentId,
      status
    });
  }
  localStorage.setItem('mock_attendance', JSON.stringify(attendances));
};

// ==========================================
// 4. 주관식 문제 답안 제출(Submissions) CRUD
// ==========================================

// 특정 학생의 누적 전체 제출 현황 조회 (종합 리포트용)
export const getAllStudentSubmissions = async (classId: string, studentId: string): Promise<Submission[]> => {
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'submissions'), 
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      const submissions: Submission[] = [];
      querySnapshot.forEach((doc) => {
        submissions.push({ id: doc.id, ...doc.data() } as Submission);
      });
      return submissions;
    } catch (e) {
      console.error('Firebase DB 에러 (전체 제출 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_submissions');
  const submissions: Submission[] = localData ? JSON.parse(localData) : [];
  return submissions.filter(s => s.classId === classId && s.studentId === studentId);
};

// 학생 누적 종합 AI 리포트 캐싱 저장
export const saveComprehensiveReport = async (classId: string, studentId: string, reportText: string): Promise<void> => {
  const docId = `${classId}_${studentId}`;
  const timestamp = new Date().toISOString();
  
  if (isFirebaseActive()) {
    try {
      await setDoc(doc(getDb(), 'comprehensive_reports', docId), {
        classId,
        studentId,
        reportText,
        updatedAt: timestamp
      });
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (종합 리포트 저장)', e);
    }
  }

  // 로컬 스토리지
  const localData = localStorage.getItem('mock_comprehensive_reports');
  const reports: any[] = localData ? JSON.parse(localData) : [];
  const index = reports.findIndex(r => r.id === docId);
  const data = { id: docId, classId, studentId, reportText, updatedAt: timestamp };
  if (index !== -1) {
    reports[index] = data;
  } else {
    reports.push(data);
  }
  localStorage.setItem('mock_comprehensive_reports', JSON.stringify(reports));
};

// 학생 누적 종합 AI 리포트 캐시 조회
export const getComprehensiveReport = async (classId: string, studentId: string): Promise<any | null> => {
  const docId = `${classId}_${studentId}`;
  
  if (isFirebaseActive()) {
    try {
      const docSnap = await getDoc(doc(getDb(), 'comprehensive_reports', docId));
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (e) {
      console.error('Firebase DB 에러 (종합 리포트 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_comprehensive_reports');
  const reports: any[] = localData ? JSON.parse(localData) : [];
  return reports.find(r => r.id === docId) || null;
};

// 특정 학생의 특정 문제 꾸러미 또는 날짜 제출 현황 조회
export const getStudentSubmissions = async (dateOrProblemId: string, classId: string, studentId: string): Promise<Submission[]> => {
  // 언더바가 들어있으면 문제 고유 ID(problemId) 조회, 없으면 날짜(date) 조회
  const isProblemId = dateOrProblemId.includes('_');

  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'submissions'), 
        where(isProblemId ? 'problemId' : 'date', '==', dateOrProblemId), 
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      const submissions: Submission[] = [];
      querySnapshot.forEach((doc) => {
        submissions.push({ id: doc.id, ...doc.data() } as Submission);
      });
      return submissions;
    } catch (e) {
      console.error('Firebase DB 에러', e);
    }
  }

  // 로컬 스토리지 백업
  const localData = localStorage.getItem('mock_submissions');
  const submissions: Submission[] = localData ? JSON.parse(localData) : [];
  return submissions.filter(s => 
    (isProblemId ? s.problemId === dateOrProblemId : s.date === dateOrProblemId) && 
    s.classId === classId &&
    s.studentId === studentId
  );
};

// 학생 답안 제출 처리 (CRUD)
export const submitAnswer = async (
  date: string,
  classId: string,
  studentId: string,
  questionId: number,
  submittedValue: string,
  isCorrect: boolean,
  elapsedTime: number,
  problemId?: string
): Promise<void> => {
  const actualProblemId = problemId || date;
  const docId = `${actualProblemId}_${classId}_${studentId}_${questionId}`;
  
  const newAttempt: SubmissionAttempt = {
    submittedValue,
    isCorrect,
    elapsedTime,
    submittedAt: new Date().toISOString()
  };

  if (isFirebaseActive()) {
    try {
      const docRef = doc(getDb(), 'submissions', docId);
      // 사전 읽기(getDoc) 없이 원자적 연산(increment, arrayUnion)으로 1회 쓰기 처리 (동시 제출 경쟁 상태 방지 및 읽기 비용 절감)
      await setDoc(docRef, {
        date,
        classId,
        problemId: actualProblemId,
        studentId,
        questionId,
        attempts: increment(1),
        history: arrayUnion(newAttempt),
        isCompleted: isCorrect
      }, { merge: true });
      return;
    } catch (e) {
      console.error('Firebase DB 에러', e);
      throw e; // 저장이 실패했음을 상위 호출처에 알려 데이터 유실 방지
    }
  }

  // 로컬 스토리지 백업
  const localData = localStorage.getItem('mock_submissions');
  const submissions: Submission[] = localData ? JSON.parse(localData) : [];
  const index = submissions.findIndex(s => s.id === docId);

  if (index !== -1) {
    const sub = submissions[index];
    sub.attempts += 1;
    sub.history.push(newAttempt);
    if (isCorrect) sub.isCompleted = true;
  } else {
    submissions.push({
      id: docId,
      date,
      classId,
      problemId: actualProblemId,
      studentId,
      questionId,
      attempts: 1,
      history: [newAttempt],
      isCompleted: isCorrect
    });
  }
  localStorage.setItem('mock_submissions', JSON.stringify(submissions));
};

// 학생이 문제 풀기를 시작했을 때 "학습 시작" 마커를 기록 (미제출 상태도 진행중으로 보이게)
export const markProblemStarted = async (
  date: string,
  classId: string,
  studentId: string,
  problemId: string
): Promise<void> => {
  const docId = `started_${problemId}_${classId}_${studentId}`;

  if (isFirebaseActive()) {
    try {
      const docRef = doc(getDb(), 'submissions', docId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        // 이미 기록이 있으면 덮어쓰지 않음
        await setDoc(docRef, {
          date,
          classId,
          problemId,
          studentId,
          questionId: 0, // 0번은 "시작 마커"를 의미
          attempts: 0,
          history: [],
          isCompleted: false,
          isStartMarker: true // 시작 마커 플래그
        });
      }
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (시작 마커)', e);
      throw e;
    }
  }

  // 로컬 스토리지 백업
  const localData = localStorage.getItem('mock_submissions');
  const submissions: Submission[] = localData ? JSON.parse(localData) : [];
  const alreadyExists = submissions.some(s => s.id === docId);
  if (!alreadyExists) {
    submissions.push({
      id: docId,
      date,
      classId,
      problemId,
      studentId,
      questionId: 0,
      attempts: 0,
      history: [],
      isCompleted: false
    });
    localStorage.setItem('mock_submissions', JSON.stringify(submissions));
  }
};

// 학생의 전체 미완료 학습 문제 세트 목록 조회 (밀린 학습용)
export const getUnfinishedProblems = async (classId: string, studentId: string, today: string): Promise<Problem[]> => {
  // 1. 모든 문제 리스트 가져오기
  let allProblems: Problem[] = [];
  if (isFirebaseActive()) {
    try {
      const querySnapshot = await getDocs(collection(getDb(), 'problems'));
      querySnapshot.forEach((doc) => {
        allProblems.push({ id: doc.id, ...doc.data() } as Problem);
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    const localData = localStorage.getItem('mock_problems');
    allProblems = localData ? JSON.parse(localData) : [];
  }

  // 오늘 이전의 배포된 문제들 중 해당 학급(classId) 대상인 문제만 필터링
  const pastProblems = allProblems.filter(
    p => p.date < today && (!p.targetClasses || p.targetClasses.length === 0 || p.targetClasses.includes(classId))
  );

  // 2. 학생의 모든 제출 이력 조회
  let allSubmissions: Submission[] = [];
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'submissions'),
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        allSubmissions.push({ id: doc.id, ...doc.data() } as Submission);
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    const localData = localStorage.getItem('mock_submissions');
    allSubmissions = localData ? JSON.parse(localData) : [];
  }

  // 3. 학생의 출결 기록 조회 (결석일 경우 미완료 목록에서 제외)
  let attendances: Attendance[] = [];
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'attendance'),
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        attendances.push({ id: doc.id, ...doc.data() } as Attendance);
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    const localData = localStorage.getItem('mock_attendance');
    const allAtt = localData ? JSON.parse(localData) : [];
    attendances = allAtt.filter((a: any) => a.studentId === studentId && a.classId === classId);
  }
  const absentDates = attendances
    .filter(a => a.status !== 'present')
    .map(a => a.date);

  const unfinished: Problem[] = [];

  for (const problem of pastProblems) {
    // 결석한 날짜는 패스
    if (absentDates.includes(problem.date)) continue;

    const totalQuestions = problem.questions.length;
    // 제출 문서 중 problemId 기준으로 필터링하여 완료 개수 확인
    const completedCount = allSubmissions.filter(
      s => s.problemId === problem.id && s.isCompleted && s.classId === classId
    ).length;

    // 다 풀지 않았으면 미완료 목록에 추가
    if (completedCount < totalQuestions) {
      unfinished.push(problem);
    }
  }

  return unfinished.sort((a, b) => b.date.localeCompare(a.date)); // 최신 밀린 과제 순
};

export interface OnlineStatus {
  id: string;
  classId: string;
  studentId: string;
  lastActiveAt: string;
}

// 학생 온라인 활성 상태 갱신 (하트비트)
export const updateStudentActiveStatus = async (classId: string, studentId: string): Promise<void> => {
  const docId = `${classId}_${studentId}`;
  const timestamp = new Date().toISOString();
  
  if (isFirebaseActive()) {
    try {
      await setDoc(doc(getDb(), 'online_status', docId), {
        classId,
        studentId,
        lastActiveAt: timestamp
      });
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (온라인 갱신)', e);
    }
  }
  
  // 로컬 스토리지 백업 모드
  const localData = localStorage.getItem('mock_online_status');
  const statusList: OnlineStatus[] = localData ? JSON.parse(localData) : [];
  const index = statusList.findIndex(s => s.id === docId);
  if (index !== -1) {
    statusList[index].lastActiveAt = timestamp;
  } else {
    statusList.push({ id: docId, classId, studentId, lastActiveAt: timestamp });
  }
  localStorage.setItem('mock_online_status', JSON.stringify(statusList));
};

// 학생 온라인 활성 상태 즉시 해제 (로그아웃 / 창 닫기 시 파괴)
export const setStudentOffline = async (classId: string, studentId: string): Promise<void> => {
  const docId = `${classId}_${studentId}`;
  
  if (isFirebaseActive()) {
    try {
      await deleteDoc(doc(getDb(), 'online_status', docId));
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (오프라인 설정)', e);
    }
  }
  
  // 로컬 스토리지 모드 백업
  const localData = localStorage.getItem('mock_online_status');
  if (localData) {
    let statusList: OnlineStatus[] = JSON.parse(localData);
    statusList = statusList.filter(s => s.id !== docId);
    localStorage.setItem('mock_online_status', JSON.stringify(statusList));
  }
};

// 전체 배포된 문제 목록 일괄 조회 (누적 통계용)
export const getAllProblems = async (): Promise<Problem[]> => {
  if (isFirebaseActive()) {
    try {
      const querySnapshot = await getDocs(collection(getDb(), 'problems'));
      const list: Problem[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Problem);
      });
      return list;
    } catch (e) {
      console.error('Firebase DB 에러 (전체 문제 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_problems');
  return localData ? JSON.parse(localData) : [];
};

// 특정 학급 반 전체 온라인 상태 실시간 구독 (onSnapshot 리스너 연계)
export const subscribeOnlineStatuses = (
  classId: string,
  onUpdate: (statuses: OnlineStatus[]) => void
): (() => void) => {
  if (isFirebaseActive()) {
    try {
      const q = query(collection(getDb(), 'online_status'), where('classId', '==', classId));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const list: OnlineStatus[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as OnlineStatus);
        });
        onUpdate(list);
      });
      return unsubscribe;
    } catch (e) {
      console.error('Firebase DB 에러 (온라인 구독)', e);
    }
  }

  // 로컬 스토리지 모드 폴백: 3초 주기로 로컬스토리지 갱신 확인 폴링 작동 후 취소자 반환
  const fetchLocal = () => {
    const localData = localStorage.getItem('mock_online_status');
    const statusList: OnlineStatus[] = localData ? JSON.parse(localData) : [];
    onUpdate(statusList.filter(s => s.classId === classId));
  };
  
  fetchLocal();
  const interval = setInterval(fetchLocal, 3000);
  return () => clearInterval(interval);
};

// 특정 학생의 전체 출결 현황 목록 일괄 조회 (학습 달력용)
export const getStudentAttendanceList = async (classId: string, studentId: string): Promise<Attendance[]> => {
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'attendance'),
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      const list: Attendance[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Attendance);
      });
      return list;
    } catch (e) {
      console.error('Firebase DB 에러 (학생 출결 이력 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_attendance');
  const allAtt = localData ? JSON.parse(localData) : [];
  return allAtt.filter((a: any) => a.studentId === studentId && a.classId === classId);
};

// 학급 전체 학생의 모든 제출 이력 일괄 조회 (교사용 월간 진도표)
export const getClassAllSubmissions = async (classId: string): Promise<Submission[]> => {
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'submissions'),
        where('classId', '==', classId)
      );
      const querySnapshot = await getDocs(q);
      const list: Submission[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Submission);
      });
      return list;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 전체 제출 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_submissions');
  const allSubs = localData ? JSON.parse(localData) : [];
  return allSubs.filter((s: any) => s.classId === classId);
};

// 학급 전체 학생의 모든 출결 기록 일괄 조회 (교사용 월간 진도표)
export const getClassAllAttendances = async (classId: string): Promise<Attendance[]> => {
  if (isFirebaseActive()) {
    try {
      const q = query(
        collection(getDb(), 'attendance'),
        where('classId', '==', classId)
      );
      const querySnapshot = await getDocs(q);
      const list: Attendance[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Attendance);
      });
      return list;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 전체 출결 조회)', e);
    }
  }

  const localData = localStorage.getItem('mock_attendance');
  const allAtt = localData ? JSON.parse(localData) : [];
  return allAtt.filter((a: any) => a.classId === classId);
};

// 학급 전체 학생의 제출 상태 실시간 구독 리스너 (특정 date 지정 시 해당 날짜만 효율적 구독)
export const subscribeClassSubmissions = (
  classId: string,
  onUpdate: (submissions: Submission[]) => void,
  date?: string
) => {
  if (isFirebaseActive()) {
    try {
      let q = query(
        collection(getDb(), 'submissions'),
        where('classId', '==', classId)
      );
      if (date) {
        q = query(
          collection(getDb(), 'submissions'),
          where('classId', '==', classId),
          where('date', '==', date)
        );
      }
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const list: Submission[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Submission);
        });
        onUpdate(list);
      });
      return unsubscribe;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 제출 실시간 구독)', e);
    }
  }

  // 로컬 스토리지 모드 폴백: 3초 주기로 로컬스토리지 갱신 확인 폴링 작동
  const fetchLocal = () => {
    const localData = localStorage.getItem('mock_submissions');
    const allSubs: Submission[] = localData ? JSON.parse(localData) : [];
    const filteredByClass = allSubs.filter(s => s.classId === classId);
    onUpdate(date ? filteredByClass.filter(s => s.date === date) : filteredByClass);
  };
  
  fetchLocal();
  const interval = setInterval(fetchLocal, 3000);
  return () => clearInterval(interval);
};

// 학급 반 목록 조회 (정렬 우선순위 적용 및 시드 데이터 자동 생성)
// 학급 반 목록 정렬 헬퍼 함수
const sortClassList = (classList: SchoolClass[]): SchoolClass[] => {
  return classList.sort((a, b) => {
    const orderA = a.sortOrder !== undefined ? a.sortOrder : 999;
    const orderB = b.sortOrder !== undefined ? b.sortOrder : 999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};

// 학급 반 목록 조회 (정렬 우선순위 적용 및 좀비 학급 자동 생성 방지)
export const getAllClasses = async (): Promise<SchoolClass[]> => {
  let list: SchoolClass[] = [];

  if (isFirebaseActive()) {
    try {
      const querySnapshot = await getDocs(collection(getDb(), 'classes'));
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SchoolClass);
      });
      // 🌟 Firebase 모드에서는 Firestore의 실제 저장 상태를 엄격히 존중합니다.
      return sortClassList(list);
    } catch (e) {
      console.error('Firebase DB 에러 (학급 목록 조회)', e);
    }
  }

  // 로컬 스토리지 모드 폴백 (사용자가 삭제한 상태 영구 보존)
  const isInitialized = localStorage.getItem('classes_initialized') === 'true';
  const localData = localStorage.getItem('mock_classes');

  if (localData !== null) {
    // 💡 사용자가 학급을 삭제하여 빈 배열([])이 되었더라도 그대로 인정하고 좀비 1~6반을 부활시키지 않음!
    list = JSON.parse(localData);
  } else if (!isInitialized) {
    // 💡 앱 최초 실행 시에만 단 1회 1반을 기본 생성
    const defaultNames = ['1반'];
    list = defaultNames.map((name, i) => ({
      id: name,
      name: name,
      createdAt: new Date().toISOString(),
      sortOrder: i
    }));
    localStorage.setItem('mock_classes', JSON.stringify(list));
    localStorage.setItem('classes_initialized', 'true');
  } else {
    // 이미 초기화된 적이 있으나 데이터가 없는 경우 빈 목록 유지
    list = [];
  }

  return sortClassList(list);
};

// 학급 반 추가 (맨 뒤 sortOrder로 자동 배치)
export const addClass = async (className: string): Promise<void> => {
  const currentList = await getAllClasses();
  const maxOrder = currentList.reduce((max, c) => {
    const order = c.sortOrder !== undefined ? c.sortOrder : 0;
    return order > max ? order : max;
  }, 0);

  const classData: SchoolClass = {
    id: className,
    name: className,
    createdAt: new Date().toISOString(),
    sortOrder: maxOrder + 1
  };

  if (isFirebaseActive()) {
    try {
      await setDoc(doc(getDb(), 'classes', className), classData);
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 추가)', e);
      throw e;
    }
  }

  // 로컬 폴백
  if (!currentList.some(c => c.name === className)) {
    currentList.push(classData);
    localStorage.setItem('mock_classes', JSON.stringify(currentList));
  }
};

// 학급 반 이름 수정 시 관련 예하 모든 종속 데이터(학생, 출결, 제출 기록, 종합 리포트, 온라인 상태, 문제 배포 대상 목록)와 문서 고유 키(ID)를 일괄 이관하는 마이그레이션 함수
export const migrateClassData = async (oldName: string, newName: string): Promise<void> => {
  if (isFirebaseActive()) {
    try {
      // 1. 학생(students) 문서 ID 재생성 및 이관
      const studentsSnapshot = await getDocs(query(collection(getDb(), 'students'), where('classId', '==', oldName)));
      for (const studentDoc of studentsSnapshot.docs) {
        const data = studentDoc.data();
        const newDocId = `${newName}_${data.id}`;
        await setDoc(doc(getDb(), 'students', newDocId), { ...data, classId: newName });
        if (studentDoc.id !== newDocId) {
          await deleteDoc(studentDoc.ref);
        }
      }

      // 2. 출결(attendance) 문서 ID 재생성 및 이관
      const attendancesSnapshot = await getDocs(query(collection(getDb(), 'attendance'), where('classId', '==', oldName)));
      for (const attDoc of attendancesSnapshot.docs) {
        const data = attDoc.data();
        const newDocId = `${data.date}_${newName}_${data.studentId}`;
        await setDoc(doc(getDb(), 'attendance', newDocId), { ...data, classId: newName });
        if (attDoc.id !== newDocId) {
          await deleteDoc(attDoc.ref);
        }
      }

      // 3. 제출 기록(submissions) 문서 ID 재생성 및 이관
      const submissionsSnapshot = await getDocs(query(collection(getDb(), 'submissions'), where('classId', '==', oldName)));
      for (const subDoc of submissionsSnapshot.docs) {
        const data = subDoc.data();
        const probId = data.problemId || data.date;
        const isStarted = data.isStartMarker || data.questionId === 0 || subDoc.id.startsWith('started_');
        const newDocId = isStarted
          ? `started_${probId}_${newName}_${data.studentId}`
          : `${probId}_${newName}_${data.studentId}_${data.questionId}`;
        await setDoc(doc(getDb(), 'submissions', newDocId), { ...data, classId: newName });
        if (subDoc.id !== newDocId) {
          await deleteDoc(subDoc.ref);
        }
      }

      // 4. 누적 종합 리포트(comprehensive_reports) 문서 ID 재생성 및 이관
      const reportsSnapshot = await getDocs(query(collection(getDb(), 'comprehensive_reports'), where('classId', '==', oldName)));
      for (const repDoc of reportsSnapshot.docs) {
        const data = repDoc.data();
        const newDocId = `${newName}_${data.studentId}`;
        await setDoc(doc(getDb(), 'comprehensive_reports', newDocId), { ...data, classId: newName });
        if (repDoc.id !== newDocId) {
          await deleteDoc(repDoc.ref);
        }
      }

      // 5. 실시간 온라인 상태(online_status) 문서 ID 재생성 및 이관
      const onlineSnapshot = await getDocs(query(collection(getDb(), 'online_status'), where('classId', '==', oldName)));
      for (const onDoc of onlineSnapshot.docs) {
        const data = onDoc.data();
        const newDocId = `${newName}_${data.studentId}`;
        await setDoc(doc(getDb(), 'online_status', newDocId), { ...data, classId: newName });
        if (onDoc.id !== newDocId) {
          await deleteDoc(onDoc.ref);
        }
      }

      // 6. 배포된 문제(problems)의 targetClasses 내 구형 이름 변경 이관
      const problemsSnapshot = await getDocs(collection(getDb(), 'problems'));
      for (const probDoc of problemsSnapshot.docs) {
        const probData = probDoc.data() as Problem;
        if (probData.targetClasses && probData.targetClasses.includes(oldName)) {
          const updatedTargets = Array.from(new Set(probData.targetClasses.map(c => c === oldName ? newName : c)));
          await updateDoc(doc(getDb(), 'problems', probDoc.id), { targetClasses: updatedTargets });
        }
      }
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 데이터 마이그레이션 실패)', e);
      throw e;
    }
  }

  // 로컬 스토리지 모드 폴백 이관 (id 필드까지 함께 갱신)
  // 1. 로컬 학생 이관
  const localSt = localStorage.getItem('mock_students');
  if (localSt) {
    const list: Student[] = JSON.parse(localSt);
    const updated = list.map(s => s.classId === oldName ? { ...s, classId: newName } : s);
    localStorage.setItem('mock_students', JSON.stringify(updated));
  }

  // 2. 로컬 출결 이관
  const localAtt = localStorage.getItem('mock_attendance');
  if (localAtt) {
    const list: Attendance[] = JSON.parse(localAtt);
    const updated = list.map(a => a.classId === oldName ? {
      ...a,
      id: `${a.date}_${newName}_${a.studentId}`,
      classId: newName
    } : a);
    localStorage.setItem('mock_attendance', JSON.stringify(updated));
  }

  // 3. 로컬 제출 기록 이관
  const localSub = localStorage.getItem('mock_submissions');
  if (localSub) {
    const list: Submission[] = JSON.parse(localSub);
    const updated = list.map(s => {
      if (s.classId !== oldName) return s;
      const probId = s.problemId || s.date;
      const isStarted = s.questionId === 0 || String(s.id).startsWith('started_');
      return {
        ...s,
        id: isStarted
          ? `started_${probId}_${newName}_${s.studentId}`
          : `${probId}_${newName}_${s.studentId}_${s.questionId}`,
        classId: newName
      };
    });
    localStorage.setItem('mock_submissions', JSON.stringify(updated));
  }

  // 4. 로컬 종합 리포트 이관
  const localReports = localStorage.getItem('mock_comprehensive_reports');
  if (localReports) {
    const list: any[] = JSON.parse(localReports);
    const updated = list.map(r => r.classId === oldName ? {
      ...r,
      id: `${newName}_${r.studentId}`,
      classId: newName
    } : r);
    localStorage.setItem('mock_comprehensive_reports', JSON.stringify(updated));
  }

  // 5. 로컬 온라인 상태 이관
  const localOnline = localStorage.getItem('mock_online_status');
  if (localOnline) {
    const list: OnlineStatus[] = JSON.parse(localOnline);
    const updated = list.map(o => o.classId === oldName ? {
      ...o,
      id: `${newName}_${o.studentId}`,
      classId: newName
    } : o);
    localStorage.setItem('mock_online_status', JSON.stringify(updated));
  }

  // 6. 로컬 배포 문제 이관
  const localProb = localStorage.getItem('mock_problems');
  if (localProb) {
    const list: Problem[] = JSON.parse(localProb);
    const updated = list.map(p => {
      if (p.targetClasses && p.targetClasses.includes(oldName)) {
        return {
          ...p,
          targetClasses: Array.from(new Set(p.targetClasses.map(c => c === oldName ? newName : c)))
        };
      }
      return p;
    });
    localStorage.setItem('mock_problems', JSON.stringify(updated));
  }
};

// 학급 반 정보 수정 (이름 변경 시, 종속 데이터 마이그레이션 연쇄 작동 및 문서 ID 재생성)
export const updateClass = async (classId: string, updates: Partial<SchoolClass>): Promise<void> => {
  if (updates.name && updates.name !== classId) {
    const oldName = classId;
    const newName = updates.name;

    // ① 종속 하위 데이터 마이그레이션 선행 작동
    await migrateClassData(oldName, newName);

    if (isFirebaseActive()) {
      try {
        const oldDocRef = doc(getDb(), 'classes', oldName);
        const oldDocSnap = await getDoc(oldDocRef);
        const oldData = oldDocSnap.exists() ? oldDocSnap.data() : {};

        // ② 새 이름으로 문서 저장 (정렬 순서 상속)
        const newClassData = {
          ...oldData,
          id: newName,
          name: newName,
          createdAt: oldData.createdAt || new Date().toISOString(),
          sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : (oldData.sortOrder !== undefined ? oldData.sortOrder : 0)
        };
        await setDoc(doc(getDb(), 'classes', newName), newClassData);

        // ③ 기존 문서 삭제
        await deleteDoc(oldDocRef);
        return;
      } catch (e) {
        console.error('Firebase DB 에러 (학급 수정 및 이관 실패)', e);
        throw e;
      }
    }

    // 로컬 폴백
    const list = await getAllClasses();
    const index = list.findIndex(c => c.id === oldName);
    if (index !== -1) {
      const oldData = list[index];
      list[index] = {
        ...oldData,
        id: newName,
        name: newName,
        sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : (oldData.sortOrder !== undefined ? oldData.sortOrder : 0)
      };
      localStorage.setItem('mock_classes', JSON.stringify(list));
    }
    return;
  }

  // 단순 순서(sortOrder) 등 명칭 이외의 정보 수정 시
  if (isFirebaseActive()) {
    try {
      await updateDoc(doc(getDb(), 'classes', classId), updates);
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 수정)', e);
      throw e;
    }
  }

  // 로컬 폴백
  const list = await getAllClasses();
  const index = list.findIndex(c => c.id === classId);
  if (index !== -1) {
    list[index] = { ...list[index], ...updates };
    localStorage.setItem('mock_classes', JSON.stringify(list));
  }
};

// 학급 반 삭제 (영구 삭제 보장, 부활 차단 및 해당 반의 고아 데이터 일괄 정리)
export const deleteClass = async (classId: string): Promise<void> => {
  if (isFirebaseActive()) {
    try {
      await deleteDoc(doc(getDb(), 'classes', classId));

      // 해당 학급에 속한 종속 컬렉션 문서들 일괄 삭제
      const collectionsToClean = ['students', 'attendance', 'submissions', 'online_status', 'comprehensive_reports'];
      for (const colName of collectionsToClean) {
        const snap = await getDocs(query(collection(getDb(), colName), where('classId', '==', classId)));
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }

      // 문제(problems) 배포 대상 목록에서 삭제된 학급 제거
      const probSnap = await getDocs(collection(getDb(), 'problems'));
      for (const probDoc of probSnap.docs) {
        const probData = probDoc.data() as Problem;
        if (probData.targetClasses && probData.targetClasses.includes(classId)) {
          const updatedTargets = probData.targetClasses.filter(c => c !== classId);
          await updateDoc(probDoc.ref, { targetClasses: updatedTargets });
        }
      }
      return;
    } catch (e) {
      console.error('Firebase DB 에러 (학급 삭제)', e);
      throw e;
    }
  }

  // 로컬 폴백 (삭제 상태를 확실히 기억하도록 플래그 갱신 및 관련 로컬 데이터 일괄 정리)
  const list = await getAllClasses();
  const filtered = list.filter(c => c.id !== classId);
  localStorage.setItem('mock_classes', JSON.stringify(filtered));
  localStorage.setItem('classes_initialized', 'true');

  const localKeys = ['mock_students', 'mock_attendance', 'mock_submissions', 'mock_online_status', 'mock_comprehensive_reports'];
  for (const key of localKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      const items: any[] = JSON.parse(raw);
      localStorage.setItem(key, JSON.stringify(items.filter(item => item.classId !== classId)));
    }
  }

  const localProb = localStorage.getItem('mock_problems');
  if (localProb) {
    const probs: Problem[] = JSON.parse(localProb);
    const updatedProbs = probs.map(p => p.targetClasses ? {
      ...p,
      targetClasses: p.targetClasses.filter(c => c !== classId)
    } : p);
    localStorage.setItem('mock_problems', JSON.stringify(updatedProbs));
  }
};

