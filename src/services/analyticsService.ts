import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy, 
  limit 
} from 'firebase/firestore';
import { getActiveDb } from '../firebase';
import { isFirebaseActive } from '../db';

// 🌟 일별 글로벌 익명 통계 데이터 인터페이스
export interface DailyAnalyticsData {
  date: string; // YYYY-MM-DD
  visits: number; // 총 페이지 방문(접속) 수
  uniqueVisitors: number; // 1일 1회 순 방문자 수 (DAU)
  uniqueTeachers: number; // 1일 1회 순 교사 로그인 수 (Teacher DAU)
  newTeachers: number; // 오늘 최초 로그인한 신규 교사 수
  returningTeachers: number; // 오늘 재방문한 지속 교사 수
  newStudents: number; // 오늘 최초 학습 활동을 시작한 신규 학생 수
  returningStudents: number; // 오늘 재방문하여 학습한 지속 학생 수
  teacherLogins: number; // 총 교사 로그인 횟수
  problemsSolved: number; // 학생들이 완료한 총 문항/세트 풀이 건수
  hourlyVisits: { [hour: string]: number }; // 0시~23시 시간대별 방문 수
  hourlySolves: { [hour: string]: number }; // 0시~23시 시간대별 풀이 수
  updatedAt: string;
}

// 🌟 전체 누적 요약 통계 인터페이스
export interface GlobalAnalyticsSummary {
  todayVisits: number;
  todayUniqueVisitors: number;
  todayUniqueTeachers: number;
  todayNewTeachers: number;
  todayReturningTeachers: number;
  todayNewStudents: number;
  todayReturningStudents: number;
  todayTeacherLogins: number;
  todayProblemsSolved: number;
  totalVisits: number;
  totalUniqueVisitors: number;
  totalUniqueTeachers: number;
  totalNewTeachers: number;
  totalNewStudents: number;
  totalProblemsSolved: number;
  totalAccumulatedTeachers: number; // 전체 누적 등록 교사 수
  totalAccumulatedStudents: number; // 전체 누적 활동 학생 수
  teacherRetentionRate: number; // 교사 재방문 지속 사용률 (%)
  studentRetentionRate: number; // 학생 재방문 지속 학습률 (%)
  activeDaysCount: number;
  dailyStats: DailyAnalyticsData[];
}

// ⚡ 0초 딜레이 즉시 렌더링을 위한 글로벌 메모리 캐시
let globalAnalyticsCache: { [key: string]: { data: GlobalAnalyticsSummary; timestamp: number } } = {};

/**
 * ⚡ 동기식 즉시 캐시 데이터 반환 (탭 클릭 시 0ms 딜레이로 즉시 화면 렌더링)
 */
export const getCachedGlobalAnalyticsSummary = (key: string = 'preset_14'): GlobalAnalyticsSummary | null => {
  return globalAnalyticsCache[key]?.data || null;
};

// 한국 시간 기준 YYYY-MM-DD 및 현재 시(Hour) 반환 헬퍼
export const getKoreanDateInfo = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  const dateStr = localDate.toISOString().split('T')[0];
  const hourStr = String(now.getHours());
  return { dateStr, hourStr };
};

// 1일 단위 임시 익명 세션 ID 획득 (개인정보 없는 순수 브라우저 랜덤 식별자)
const getAnonymousSessionId = (): string => {
  const STORAGE_KEY = 'edukraft_anon_session';
  const { dateStr } = getKoreanDateInfo();
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === dateStr && parsed.id) {
        return parsed.id;
      }
    }
    
    // 신규 익명 세션 생성
    const newId = 'anon_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: dateStr, id: newId }));
    return newId;
  } catch {
    return 'anon_fallback';
  }
};

// 이메일 단방향 단순 해시 생성 (개인정보 보호용)
const hashEmail = (email: string): string => {
  let hash = 0;
  const clean = email.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'tch_' + Math.abs(hash).toString(36);
};

/**
 * 📊 1. 글로벌 익명 방문(접속) 이벤트 비동기 기록
 */
export const trackGlobalVisit = async (): Promise<void> => {
  if (!isFirebaseActive()) return;

  try {
    const db = getActiveDb();
    const { dateStr, hourStr } = getKoreanDateInfo();
    const sessionId = getAnonymousSessionId();
    const docRef = doc(db, '_global_analytics_', dateStr);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const existingSessions: string[] = data.sessionIds || [];
      const isNewUnique = !existingSessions.includes(sessionId);

      const updatedSessions = isNewUnique 
        ? [...existingSessions.slice(-3000), sessionId] 
        : existingSessions;

      await updateDoc(docRef, {
        visits: increment(1),
        uniqueVisitors: isNewUnique ? increment(1) : (data.uniqueVisitors || 1),
        sessionIds: updatedSessions,
        [`hourlyVisits.${hourStr}`]: increment(1),
        updatedAt: new Date().toISOString()
      });
    } else {
      await setDoc(docRef, {
        date: dateStr,
        visits: 1,
        uniqueVisitors: 1,
        uniqueTeachers: 0,
        newTeachers: 0,
        returningTeachers: 0,
        newStudents: 0,
        returningStudents: 0,
        teacherLogins: 0,
        teacherHashes: [],
        problemsSolved: 0,
        sessionIds: [sessionId],
        hourlyVisits: { [hourStr]: 1 },
        hourlySolves: {},
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.debug('Analytics visit track skipped:', err);
  }
};

/**
 * 📊 2. 글로벌 교사 로그인 이벤트 비동기 기록 (신규 vs 재방문 지속 교사 자동 판별)
 */
export const trackGlobalTeacherLogin = async (teacherEmail: string): Promise<void> => {
  if (!isFirebaseActive() || !teacherEmail) return;

  try {
    const db = getActiveDb();
    const { dateStr } = getKoreanDateInfo();
    const tchHash = hashEmail(teacherEmail);
    
    // 메타 레지스트리에서 신규 교사 여부 확인
    const registryRef = doc(db, '_global_analytics_meta_', 'users_registry');
    let isBrandNewTeacher = false;

    try {
      const regSnap = await getDoc(registryRef);
      if (regSnap.exists()) {
        const regData = regSnap.data();
        const teacherMap = regData.teacherRegistry || {};
        if (!teacherMap[tchHash]) {
          isBrandNewTeacher = true;
          await updateDoc(registryRef, {
            [`teacherRegistry.${tchHash}`]: { firstSeen: dateStr, lastSeen: dateStr },
            totalRegisteredTeachers: increment(1),
            updatedAt: new Date().toISOString()
          });
        } else {
          await updateDoc(registryRef, {
            [`teacherRegistry.${tchHash}.lastSeen`]: dateStr,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        isBrandNewTeacher = true;
        await setDoc(registryRef, {
          teacherRegistry: { [tchHash]: { firstSeen: dateStr, lastSeen: dateStr } },
          studentRegistry: {},
          totalRegisteredTeachers: 1,
          totalRegisteredStudents: 0,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.debug('Registry update fallback:', e);
    }

    const docRef = doc(db, '_global_analytics_', dateStr);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const existingTchHashes: string[] = data.teacherHashes || [];
      const isNewTeacherToday = !existingTchHashes.includes(tchHash);

      const updatedHashes = isNewTeacherToday
        ? [...existingTchHashes.slice(-1000), tchHash]
        : existingTchHashes;

      const updates: any = {
        teacherLogins: increment(1),
        teacherHashes: updatedHashes,
        updatedAt: new Date().toISOString()
      };

      if (isNewTeacherToday) {
        updates.uniqueTeachers = increment(1);
        if (isBrandNewTeacher) {
          updates.newTeachers = increment(1);
        } else {
          updates.returningTeachers = increment(1);
        }
      }

      await updateDoc(docRef, updates);
    } else {
      await setDoc(docRef, {
        date: dateStr,
        visits: 1,
        uniqueVisitors: 1,
        uniqueTeachers: 1,
        newTeachers: isBrandNewTeacher ? 1 : 0,
        returningTeachers: isBrandNewTeacher ? 0 : 1,
        newStudents: 0,
        returningStudents: 0,
        teacherLogins: 1,
        teacherHashes: [tchHash],
        problemsSolved: 0,
        sessionIds: [],
        hourlyVisits: {},
        hourlySolves: {},
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.debug('Analytics teacher login track skipped:', err);
  }
};

/**
 * 📊 3. 글로벌 학생 학습 활동 이벤트 비동기 기록 (방안 A: 첫 학습 활동 기준 신규 vs 지속 학생 판별)
 */
export const trackGlobalStudentActivity = async (classId: string, studentId: string | number): Promise<void> => {
  if (!isFirebaseActive() || !classId || !studentId) return;

  try {
    const db = getActiveDb();
    const { dateStr } = getKoreanDateInfo();
    const studentKey = `${classId}_${studentId}`;

    const registryRef = doc(db, '_global_analytics_meta_', 'users_registry');
    let isBrandNewStudent = false;

    try {
      const regSnap = await getDoc(registryRef);
      if (regSnap.exists()) {
        const regData = regSnap.data();
        const studentMap = regData.studentRegistry || {};
        if (!studentMap[studentKey]) {
          isBrandNewStudent = true;
          await updateDoc(registryRef, {
            [`studentRegistry.${studentKey}`]: { firstSeen: dateStr, lastSeen: dateStr },
            totalRegisteredStudents: increment(1),
            updatedAt: new Date().toISOString()
          });
        } else {
          await updateDoc(registryRef, {
            [`studentRegistry.${studentKey}.lastSeen`]: dateStr,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        isBrandNewStudent = true;
        await setDoc(registryRef, {
          teacherRegistry: {},
          studentRegistry: { [studentKey]: { firstSeen: dateStr, lastSeen: dateStr } },
          totalRegisteredTeachers: 0,
          totalRegisteredStudents: 1,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.debug('Student registry update fallback:', e);
    }

    const docRef = doc(db, '_global_analytics_', dateStr);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        newStudents: isBrandNewStudent ? increment(1) : increment(0),
        returningStudents: isBrandNewStudent ? increment(0) : increment(1),
        updatedAt: new Date().toISOString()
      });
    } else {
      await setDoc(docRef, {
        date: dateStr,
        visits: 1,
        uniqueVisitors: 1,
        uniqueTeachers: 0,
        newTeachers: 0,
        returningTeachers: 0,
        newStudents: isBrandNewStudent ? 1 : 0,
        returningStudents: isBrandNewStudent ? 0 : 1,
        teacherLogins: 0,
        teacherHashes: [],
        problemsSolved: 0,
        sessionIds: [],
        hourlyVisits: {},
        hourlySolves: {},
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.debug('Analytics student activity track skipped:', err);
  }
};

/**
 * 📊 4. 글로벌 익명 문제 풀이 완료 이벤트 비동기 기록
 */
export const trackGlobalSolve = async (
  questionsCount: number = 1,
  classId?: string,
  studentId?: string | number
): Promise<void> => {
  if (!isFirebaseActive()) return;

  try {
    const db = getActiveDb();
    const { dateStr, hourStr } = getKoreanDateInfo();
    const docRef = doc(db, '_global_analytics_', dateStr);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, {
        problemsSolved: increment(questionsCount),
        [`hourlySolves.${hourStr}`]: increment(questionsCount),
        updatedAt: new Date().toISOString()
      });
    } else {
      await setDoc(docRef, {
        date: dateStr,
        visits: 1,
        uniqueVisitors: 1,
        uniqueTeachers: 0,
        newTeachers: 0,
        returningTeachers: 0,
        newStudents: 0,
        returningStudents: 0,
        teacherLogins: 0,
        teacherHashes: [],
        problemsSolved: questionsCount,
        sessionIds: [],
        hourlyVisits: {},
        hourlySolves: { [hourStr]: questionsCount },
        updatedAt: new Date().toISOString()
      });
    }

    // 학생 정보가 전달되었을 경우 학생 첫 학습 활동/지속 판별 기록 연계
    if (classId && studentId) {
      await trackGlobalStudentActivity(classId, studentId);
    }
  } catch (err) {
    console.debug('Analytics solve track skipped:', err);
  }
};

/**
 * 📈 5. 개발자 대시보드용 전체 글로벌 통계 요약 데이터 조회 (신규/지속/리텐션 포함)
 */
export const getGlobalAnalyticsSummary = async (
  startDate?: string, 
  endDate?: string, 
  days: number = 30
): Promise<GlobalAnalyticsSummary> => {
  const cacheKey = (startDate && endDate) ? `range_${startDate}_${endDate}` : `preset_${days}`;

  if (!isFirebaseActive()) {
    return {
      todayVisits: 0,
      todayUniqueVisitors: 0,
      todayUniqueTeachers: 0,
      todayNewTeachers: 0,
      todayReturningTeachers: 0,
      todayNewStudents: 0,
      todayReturningStudents: 0,
      todayTeacherLogins: 0,
      todayProblemsSolved: 0,
      totalVisits: 0,
      totalUniqueVisitors: 0,
      totalUniqueTeachers: 0,
      totalNewTeachers: 0,
      totalNewStudents: 0,
      totalProblemsSolved: 0,
      totalAccumulatedTeachers: 0,
      totalAccumulatedStudents: 0,
      teacherRetentionRate: 100,
      studentRetentionRate: 100,
      activeDaysCount: 0,
      dailyStats: []
    };
  }

  try {
    const db = getActiveDb();
    let q;

    if (startDate && endDate) {
      q = query(
        collection(db, '_global_analytics_'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
    } else {
      q = query(
        collection(db, '_global_analytics_'), 
        orderBy('date', 'desc'), 
        limit(days)
      );
    }

    const [snapshot, regSnap] = await Promise.all([
      getDocs(q),
      getDoc(doc(db, '_global_analytics_meta_', 'users_registry')).catch(() => null)
    ]);

    const dailyStats: DailyAnalyticsData[] = [];

    let totalVisits = 0;
    let totalUniqueVisitors = 0;
    let totalUniqueTeachers = 0;
    let totalNewTeachers = 0;
    let totalNewStudents = 0;
    let totalProblemsSolved = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const uniqueTeachers = Number(data.uniqueTeachers || (data.teacherHashes?.length || (data.teacherLogins ? 1 : 0)));
      const newTeachers = Number(data.newTeachers || 0);
      const returningTeachers = Number(data.returningTeachers || Math.max(0, uniqueTeachers - newTeachers));
      
      const newStudents = Number(data.newStudents || 0);
      const returningStudents = Number(data.returningStudents || 0);

      const item: DailyAnalyticsData = {
        date: data.date || docSnap.id,
        visits: Number(data.visits || 0),
        uniqueVisitors: Number(data.uniqueVisitors || (data.sessionIds?.length || 1)),
        uniqueTeachers,
        newTeachers,
        returningTeachers,
        newStudents,
        returningStudents,
        teacherLogins: Number(data.teacherLogins || 0),
        problemsSolved: Number(data.problemsSolved || 0),
        hourlyVisits: data.hourlyVisits || {},
        hourlySolves: data.hourlySolves || {},
        updatedAt: data.updatedAt || ''
      };
      
      dailyStats.push(item);
      totalVisits += item.visits;
      totalUniqueVisitors += item.uniqueVisitors;
      totalUniqueTeachers += item.uniqueTeachers;
      totalNewTeachers += item.newTeachers;
      totalNewStudents += item.newStudents;
      totalProblemsSolved += item.problemsSolved;
    });

    dailyStats.sort((a, b) => a.date.localeCompare(b.date));

    const { dateStr: todayStr } = getKoreanDateInfo();
    const todayStat = dailyStats.find(d => d.date === todayStr);

    let totalAccumulatedTeachers = totalNewTeachers;
    let totalAccumulatedStudents = totalNewStudents;

    if (regSnap && regSnap.exists()) {
      const reg = regSnap.data();
      totalAccumulatedTeachers = Number(reg.totalRegisteredTeachers || Object.keys(reg.teacherRegistry || {}).length || totalNewTeachers);
      totalAccumulatedStudents = Number(reg.totalRegisteredStudents || Object.keys(reg.studentRegistry || {}).length || totalNewStudents);
    }

    // 교사 리텐션(재방문 비율) 계산
    const todayTeachersCount = todayStat?.uniqueTeachers || 0;
    const todayRetTeachers = todayStat?.returningTeachers || 0;
    const teacherRetentionRate = todayTeachersCount > 0 
      ? Math.round((todayRetTeachers / todayTeachersCount) * 100) 
      : 100;

    // 학생 리텐션(재방문 학습 비율) 계산
    const todayTotalStudents = (todayStat?.newStudents || 0) + (todayStat?.returningStudents || 0);
    const studentRetentionRate = todayTotalStudents > 0
      ? Math.round(((todayStat?.returningStudents || 0) / todayTotalStudents) * 100)
      : 100;

    const result: GlobalAnalyticsSummary = {
      todayVisits: todayStat?.visits || 0,
      todayUniqueVisitors: todayStat?.uniqueVisitors || 0,
      todayUniqueTeachers: todayTeachersCount,
      todayNewTeachers: todayStat?.newTeachers || 0,
      todayReturningTeachers: todayRetTeachers,
      todayNewStudents: todayStat?.newStudents || 0,
      todayReturningStudents: todayStat?.returningStudents || 0,
      todayTeacherLogins: todayStat?.teacherLogins || 0,
      todayProblemsSolved: todayStat?.problemsSolved || 0,
      totalVisits,
      totalUniqueVisitors,
      totalUniqueTeachers,
      totalNewTeachers,
      totalNewStudents,
      totalProblemsSolved,
      totalAccumulatedTeachers,
      totalAccumulatedStudents,
      teacherRetentionRate,
      studentRetentionRate,
      activeDaysCount: dailyStats.length,
      dailyStats
    };

    // ⚡ 메모리 캐시에 즉시 저장
    globalAnalyticsCache[cacheKey] = {
      data: result,
      timestamp: Date.now()
    };

    return result;
  } catch (err) {
    console.error('글로벌 통계 로드 실패:', err);
    return globalAnalyticsCache[cacheKey]?.data || {
      todayVisits: 0,
      todayUniqueVisitors: 0,
      todayUniqueTeachers: 0,
      todayNewTeachers: 0,
      todayReturningTeachers: 0,
      todayNewStudents: 0,
      todayReturningStudents: 0,
      todayTeacherLogins: 0,
      todayProblemsSolved: 0,
      totalVisits: 0,
      totalUniqueVisitors: 0,
      totalUniqueTeachers: 0,
      totalNewTeachers: 0,
      totalNewStudents: 0,
      totalProblemsSolved: 0,
      totalAccumulatedTeachers: 0,
      totalAccumulatedStudents: 0,
      teacherRetentionRate: 100,
      studentRetentionRate: 100,
      activeDaysCount: 0,
      dailyStats: []
    };
  }
};

/**
 * ⚡ 관리자 대시보드 진입 시 백그라운드로 14일치 통계를 조용히 사전 로드
 */
export const preloadGlobalAnalytics = async (): Promise<void> => {
  try {
    await getGlobalAnalyticsSummary(undefined, undefined, 14);
  } catch (err) {
    console.debug('Analytics preload skipped:', err);
  }
};
