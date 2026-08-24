// 학생 정보 타입 정의
export interface Student {
  id: string; // 학급 번호 (예: "01", "02")
  classId: string; // 학급 반 정보 (예: "1반", "2반")
  name: string; // 학생 이름
  createdAt?: string; // 등록 일시 (ISO String)
}

// 수학 문제 내 개별 질문 타입 정의
export interface Question {
  id: number; // 문제 번호 (1, 2, 3...)
  questionText: string; // 문제 내용/발문
  answers: string[]; // 허용 가능한 정답 목록 (예: ["3/2", "1.5"])
  answerGuide: string; // 정답 입력 형식 안내 (예: "기약분수로 적으세요. 예: 3/2")
  hint: string; // 오답 시 보여줄 개념 힌트 (정답 미포함)
  explanation: string; // 오답 시 문제를 최종 맞췄을 때 보여줄 상세 문제 풀이 과정
}

// 날짜별 배포된 수학 문제 꾸러미 타입 정의
export interface Problem {
  id: string; // Firestore 문서 ID (배포 날짜, 예: "2026-08-13")
  date: string; // 배포 날짜 (YYYY-MM-DD)
  grade: string; // 학년 (예: "6학년")
  chapter: string; // 단원 (예: "분수의 나눗셈")
  type: string; // 문제 유형 (예: "단순계산문제")
  questions: Question[]; // 문제 배열
  targetClasses: string[]; // 배포 대상 학급 반 목록 (예: ["1반", "2반"])
}

// 학생이 답을 제출한 시도 상세 이력 타입 정의
export interface SubmissionAttempt {
  submittedValue: string; // 학생이 제출한 답변
  isCorrect: boolean; // 채점 결과
  elapsedTime: number; // 해당 문제를 푸는데 걸린 시간 (초)
  submittedAt: string; // 제출 일시 (ISO String)
}

// 학생별 문제 제출 데이터 타입 정의
export interface Submission {
  id: string; // Firestore 문서 ID ({problemId}_{studentId}_{questionId})
  date: string; // 날짜 (YYYY-MM-DD)
  classId: string; // 학급 반 정보
  problemId: string; // 문제 세트 고유 ID
  studentId: string; // 학생 번호
  questionId: number; // 문제 번호
  attempts: number; // 시도 횟수
  history: SubmissionAttempt[]; // 제출 시도 이력 배열
  isCompleted: boolean; // 최종 해결 완료 여부
}

// 학생 출결(결석/면제) 기록 타입 정의
export interface Attendance {
  id: string; // Firestore 문서 ID ({date}_{studentId})
  date: string; // 날짜 (YYYY-MM-DD)
  classId: string; // 학급 반 정보
  studentId: string; // 학생 번호
  status: 'present' | 'absent_ill' | 'absent_approved' | 'exempt'; // present: 출석, absent_ill: 질병결석, absent_approved: 출석인정결석, exempt: 면제권
}

// 학급 반 메타데이터 타입 정의 (신설)
export interface SchoolClass {
  id: string; // Firestore 문서 ID (예: "6학년 1반")
  name: string; // 학급 반 이름 (예: "6학년 1반")
  createdAt: string; // 개설 일시 (ISO String)
  sortOrder?: number; // 🌟 학급 정렬 순서 우선순위 (낮을수록 먼저 노출)
}
