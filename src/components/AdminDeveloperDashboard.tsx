import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  getGlobalAnalyticsSummary, 
  getCachedGlobalAnalyticsSummary, 
  getKoreanDateInfo, 
  GlobalAnalyticsSummary, 
  DailyAnalyticsData 
} from '../services/analyticsService';

// ℹ️ 툴팁 안내 데이터 인터페이스
interface TooltipData {
  method: string;
  standard: string;
  purpose: string;
}

// ℹ️ 타이틀 옆 인포메이션 툴팁 팝오버 컴포넌트
const DevInfoTooltip: React.FC<{ data: TooltipData }> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        verticalAlign: 'middle', 
        marginLeft: '4px' 
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onBlur={() => setIsOpen(false)}
        aria-label="안내 도움말"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          color: '#64748B',
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'serif',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease'
        }}
      >
        i
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '6px',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '0.72rem',
          lineHeight: '1.45',
          whiteSpace: 'normal',
          minWidth: '240px',
          maxWidth: '310px',
          zIndex: 50,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          textAlign: 'left',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#A7F3D0', fontWeight: 700, whiteSpace: 'nowrap' }}>• 수집방식</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{data.method}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#93C5FD', fontWeight: 700, whiteSpace: 'nowrap' }}>• 기준설명</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{data.standard}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#FDE68A', fontWeight: 700, whiteSpace: 'nowrap' }}>• 활용목적</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{data.purpose}</span>
          </div>
        </div>
      )}
    </span>
  );
};

// 🔘 지표 토글 버튼 및 상세 호버 팝오버 컴포넌트
interface MetricButtonProps {
  label: string;
  isActive: boolean;
  activeColor: string;
  tooltipData: TooltipData;
  onClick: () => void;
}

const MetricToggleButton: React.FC<MetricButtonProps> = ({ label, isActive, activeColor, tooltipData, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '5px 11px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: isActive ? activeColor : '#F1F5F9',
          color: isActive ? '#FFFFFF' : '#94A3B8',
          fontWeight: isActive ? 700 : 500,
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: isActive ? `0 1px 3px ${activeColor}40` : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        {label}
      </button>
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '0.72rem',
          lineHeight: '1.45',
          whiteSpace: 'normal',
          minWidth: '230px',
          maxWidth: '300px',
          zIndex: 60,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.35)',
          textAlign: 'left',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#A7F3D0', fontWeight: 700, whiteSpace: 'nowrap' }}>• 수집방식</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{tooltipData.method}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#93C5FD', fontWeight: 700, whiteSpace: 'nowrap' }}>• 기준설명</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{tooltipData.standard}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '6px', alignItems: 'start' }}>
            <span style={{ color: '#FDE68A', fontWeight: 700, whiteSpace: 'nowrap' }}>• 활용목적</span>
            <span style={{ color: '#F1F5F9', wordBreak: 'keep-all' }}>{tooltipData.purpose}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const PREFS_STORAGE_KEY = 'edukraft_developer_analytics_prefs';

export const AdminDeveloperDashboard: React.FC = () => {
  // ⚡ 캐시된 데이터로 0초 즉시 초기 렌더링
  const [summary, setSummary] = useState<GlobalAnalyticsSummary | null>(() => getCachedGlobalAnalyticsSummary('preset_14'));

  // 로컬 스토리지 선호 설정 복원
  const savedPrefs = useMemo(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }, []);

  // 기간 선택 모드 (7일, 14일, 30일, 90일, 직접입력)
  const [periodMode, setPeriodMode] = useState<string>(() => savedPrefs?.periodMode || '14');
  const { dateStr: todayStr } = getKoreanDateInfo();

  // 직접입력 시작/종료일
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // 차트 모드 (막대, 꺾은선, 누적)
  const [chartType, setChartType] = useState<'bar' | 'line' | 'cumulative'>(() => savedPrefs?.chartType || 'bar');

  // 메인 차트 표시 지표 필터
  const [visibleMetrics, setVisibleMetrics] = useState({
    teachers: true,
    newTeachers: true,
    returningTeachers: false,
    newStudents: true,
    returningStudents: false,
    visitors: false,
    solves: true,
    ...(savedPrefs?.visibleMetrics || {})
  });

  // 설정값 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({
        chartType,
        periodMode,
        visibleMetrics
      }));
    } catch {}
  }, [chartType, periodMode, visibleMetrics]);

  const [isLoading, setIsLoading] = useState(true);
  const [isMainAnimated, setIsMainAnimated] = useState(false);
  const [isAuxAnimated, setIsAuxAnimated] = useState(false);

  // 반응형 SVG 너비 측정
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState<number>(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) setSvgWidth(rect.width);
      }
    };
    measure();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) setSvgWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);
  const [hoveredHourlyIndex, setHoveredHourlyIndex] = useState<number | null>(null);
  const [hoveredWeekdayIndex, setHoveredWeekdayIndex] = useState<number | null>(null);

  // 데이터 로드 핸들러
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (periodMode === 'custom') {
        const data = await getGlobalAnalyticsSummary(customStartDate, customEndDate);
        setSummary(data);
      } else {
        const data = await getGlobalAnalyticsSummary(undefined, undefined, Number(periodMode));
        setSummary(data);
      }
    } catch (err) {
      console.error('개발자 통계 로드 에러:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (periodMode !== 'custom') {
      loadData();
    }
  }, [periodMode]);

  // 차트 렌더링 애니메이션 트리거
  useEffect(() => {
    setIsMainAnimated(false);
    const timer = setTimeout(() => setIsMainAnimated(true), 40);
    return () => clearTimeout(timer);
  }, [summary, chartType, periodMode]);

  useEffect(() => {
    setIsAuxAnimated(false);
    const timer = setTimeout(() => setIsAuxAnimated(true), 40);
    return () => clearTimeout(timer);
  }, [periodMode, summary]);

  // 지표 토글 핸들러 (최소 1개 이상 활성화 유지)
  const toggleMetric = (key: keyof typeof visibleMetrics) => {
    setVisibleMetrics((prev: typeof visibleMetrics) => {
      const next = { ...prev, [key]: !prev[key] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  // 일별 통계 목록
  const dailyStats = useMemo(() => summary?.dailyStats || [], [summary]);

  // 누적 통계 배열 계산
  const cumulativeDailyStats = useMemo(() => {
    let cumTch = 0;
    let cumNewTch = 0;
    let cumRetTch = 0;
    let cumNewStd = 0;
    let cumRetStd = 0;
    let cumVis = 0;
    let cumSlv = 0;

    return dailyStats.map((item) => {
      cumTch += item.uniqueTeachers || 0;
      cumNewTch += item.newTeachers || 0;
      cumRetTch += item.returningTeachers || 0;
      cumNewStd += item.newStudents || 0;
      cumRetStd += item.returningStudents || 0;
      cumVis += item.uniqueVisitors || 0;
      cumSlv += item.problemsSolved || 0;
      return {
        ...item,
        cumTeachers: cumTch,
        cumNewTeachers: cumNewTch,
        cumRetTeachers: cumRetTch,
        cumNewStudents: cumNewStd,
        cumRetStudents: cumRetStd,
        cumVisitors: cumVis,
        cumSolves: cumSlv
      };
    });
  }, [dailyStats]);

  // 24시간대별 집계 데이터
  const hourlyStats = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => String(i));
    const visitsMap: { [h: string]: number } = {};
    const solvesMap: { [h: string]: number } = {};
    hours.forEach((h) => {
      visitsMap[h] = 0;
      solvesMap[h] = 0;
    });

    dailyStats.forEach((d) => {
      Object.entries(d.hourlyVisits || {}).forEach(([h, v]) => {
        visitsMap[h] = (visitsMap[h] || 0) + Number(v);
      });
      Object.entries(d.hourlySolves || {}).forEach(([h, v]) => {
        solvesMap[h] = (solvesMap[h] || 0) + Number(v);
      });
    });

    return hours.map((h) => ({
      hour: Number(h),
      visits: visitsMap[h] || 0,
      solves: solvesMap[h] || 0
    }));
  }, [dailyStats]);

  // 요일별 집계 데이터 (일 ~ 토)
  const weekdayStats = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const visCounts = [0, 0, 0, 0, 0, 0, 0];
    const slvCounts = [0, 0, 0, 0, 0, 0, 0];
    const tchCounts = [0, 0, 0, 0, 0, 0, 0];

    dailyStats.forEach((d) => {
      const dayIdx = new Date(d.date).getDay();
      visCounts[dayIdx] += d.uniqueVisitors || d.visits;
      slvCounts[dayIdx] += d.problemsSolved;
      tchCounts[dayIdx] += d.uniqueTeachers || 0;
    });

    return days.map((day, idx) => ({
      day,
      visitors: visCounts[idx],
      solves: slvCounts[idx],
      teachers: tchCounts[idx]
    }));
  }, [dailyStats]);

  // 메인 차트 최대값 계산 (좌측 사용자 축: 교사/학생/방문자)
  const maxVisitors = useMemo(() => {
    let maxVal = 5;
    if (chartType === 'cumulative') {
      cumulativeDailyStats.forEach((d) => {
        if (visibleMetrics.teachers) maxVal = Math.max(maxVal, d.cumTeachers);
        if (visibleMetrics.newTeachers) maxVal = Math.max(maxVal, d.cumNewTeachers);
        if (visibleMetrics.returningTeachers) maxVal = Math.max(maxVal, d.cumRetTeachers);
        if (visibleMetrics.newStudents) maxVal = Math.max(maxVal, d.cumNewStudents);
        if (visibleMetrics.returningStudents) maxVal = Math.max(maxVal, d.cumRetStudents);
        if (visibleMetrics.visitors) maxVal = Math.max(maxVal, d.cumVisitors);
      });
    } else {
      dailyStats.forEach((d) => {
        if (visibleMetrics.teachers) maxVal = Math.max(maxVal, d.uniqueTeachers || 0);
        if (visibleMetrics.newTeachers) maxVal = Math.max(maxVal, d.newTeachers || 0);
        if (visibleMetrics.returningTeachers) maxVal = Math.max(maxVal, d.returningTeachers || 0);
        if (visibleMetrics.newStudents) maxVal = Math.max(maxVal, d.newStudents || 0);
        if (visibleMetrics.returningStudents) maxVal = Math.max(maxVal, d.returningStudents || 0);
        if (visibleMetrics.visitors) maxVal = Math.max(maxVal, d.uniqueVisitors || 0);
      });
    }
    return Math.ceil(maxVal * 1.15);
  }, [dailyStats, cumulativeDailyStats, visibleMetrics, chartType]);

  // 풀이 문항 최대값 계산 (우측 듀얼 축)
  const maxSolves = useMemo(() => {
    if (!visibleMetrics.solves) return 10;
    if (chartType === 'cumulative') {
      const maxVal = Math.max(...cumulativeDailyStats.map((d) => d.cumSolves), 10);
      return Math.ceil(maxVal * 1.15);
    }
    const maxVal = Math.max(...dailyStats.map((d) => d.problemsSolved), 10);
    return Math.ceil(maxVal * 1.15);
  }, [dailyStats, cumulativeDailyStats, visibleMetrics.solves, chartType]);

  // 24시간대 최대값 계산
  const maxHourly = useMemo(() => {
    const maxVal = Math.max(...hourlyStats.map((h) => Math.max(h.visits, h.solves)), 5);
    return Math.ceil(maxVal * 1.15);
  }, [hourlyStats]);

  // X축 좌표 계산 함수
  const getX = (idx: number, total: number) => {
    const usableWidth = Math.max(100, svgWidth - 45 - 25);
    if (total <= 1) return 45 + usableWidth / 2;
    return 45 + (idx + 0.5) * (usableWidth / total);
  };

  // Polyline 점 좌표 문자열 생성 함수
  const getPolylinePoints = (getter: (d: any) => number, maxVal: number) => {
    const dataset = chartType === 'cumulative' ? cumulativeDailyStats : dailyStats;
    if (dataset.length === 0) return '';
    return dataset.map((d, idx) => {
      const cx = getX(idx, dataset.length);
      const val = getter(d);
      const cy = isMainAnimated ? 200 - (val / maxVal) * 180 : 200;
      return `${cx.toFixed(1)},${cy.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%', boxSizing: 'border-box' }}>
      {/* 🏷️ 헤더 영역: 타이틀 & 기간 선택 바 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        borderBottom: '1px solid var(--border-color)', 
        paddingBottom: '1.25rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            서비스 종합 운영 통계
          </h2>
          <DevInfoTooltip data={{
            method: '실시간 글로벌 통합 집계',
            standard: '전체 학교/학급의 신규 가입, 지속 사용 및 학습 활동 총괄',
            purpose: '전체 서비스의 운영 안정성과 성장 지표를 한눈에 모니터링'
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* 기간 필터 프리셋 버튼 세트 */}
          <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {[
              { id: '7', label: '7일' },
              { id: '14', label: '14일' },
              { id: '30', label: '30일' },
              { id: '90', label: '90일' },
              { id: 'custom', label: '직접입력' }
            ].map(({ id, label }) => {
              const isActive = periodMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodMode(id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 직접입력 기간 선택 컨트롤 */}
          {periodMode === 'custom' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>~</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={loadData}
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '6px' }}
              >
                조회
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🍱 Bento KPI 핵심 지표 요약 카드 리스트 (4개 또는 6개 균형 배치) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* 카드 1: 오늘 순 방문자 (DAU) */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>오늘 순 방문자 (DAU)</span>
            <DevInfoTooltip data={{
              method: '1일 1회만 카운팅 (중복 제거)',
              standard: '동일 기기/브라우저의 당일 재접속 및 새로고침 제외',
              purpose: '오늘 하루 접속한 실제 총 순수 사용자(학생+교사) 규모'
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.todayUniqueVisitors || 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>명</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            오늘 총 접속(페이지뷰) <strong>{summary?.todayVisits || 0}</strong>회
          </span>
        </div>

        {/* 카드 2: 오늘 접속 교사 */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>오늘 접속 교사</span>
            <DevInfoTooltip data={{
              method: '1일 1회만 카운팅 (중복 제거)',
              standard: '당일 접속한 전체 순수 교사 수 및 신규/재방문 분기 집계',
              purpose: '오늘 실제로 수업에 시스템을 활용하신 선생님 규모 파악'
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#064E3B' }}>
              {summary?.todayUniqueTeachers || 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>명</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            신규 <strong>{summary?.todayNewTeachers || 0}</strong>명 · 재방문 <strong>{summary?.todayReturningTeachers || 0}</strong>명 (누적 {summary?.totalAccumulatedTeachers || 0}명)
          </span>
        </div>

        {/* 카드 3: 오늘 활동 학생 */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>오늘 활동 학생</span>
            <DevInfoTooltip data={{
              method: '첫 학습활동 기준 판별 (방안 A)',
              standard: '오늘 문제를 푼 학생 중 생애 첫 참여 vs 지속 참여 분기',
              purpose: '새로 유입된 학생과 꾸준히 참여하는 학생 규모 파악'
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563EB' }}>
              {(summary?.todayNewStudents || 0) + (summary?.todayReturningStudents || 0)}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>명</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            신규 <strong>{summary?.todayNewStudents || 0}</strong>명 · 지속 <strong>{summary?.todayReturningStudents || 0}</strong>명 (누적 {summary?.totalAccumulatedStudents || 0}명)
          </span>
        </div>

        {/* 카드 4: 교사 지속 사용률 (리텐션) */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>교사 지속 사용률(리텐션)</span>
            <DevInfoTooltip data={{
              method: '재방문 교사 비율 계산',
              standard: '(당일 재방문 교사 / 당일 전체 접속 교사) × 100',
              purpose: '선생님들이 이탈하지 않고 매일 수업 루틴으로 정착했는지 검증'
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>
              {summary?.teacherRetentionRate ?? 100}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>%</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            재방문 중심의 안정적 정착 지표
          </span>
        </div>

        {/* 카드 5: 오늘 풀이 완료 건수 */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>오늘 풀이 완료 건수</span>
            <DevInfoTooltip data={{
              method: '실시간 누적 합산 (중복 수집)',
              standard: '학생들이 문제 풀이를 완주할 때마다 푼 문항 수만큼 실시간 누적',
              purpose: '오늘 하루 전체 학급에서 학생들이 소화한 총 학습 활동량 파악'
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706' }}>
              {summary?.todayProblemsSolved || 0}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>문항</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            기간 누적 <strong>{summary?.totalProblemsSolved || 0}</strong>문항 집계
          </span>
        </div>
      </div>

      {/* 📊 메인 SVG 인터랙티브 활동 추이 차트 카드 */}
      <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)' }}>
        {/* 상단 컨트롤: 타이틀, 차트 유형(막대/꺾은선/누적), 지표 토글 버튼 세트 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              일별 활동 추이
            </h3>
            <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: chartType === 'bar' ? 700 : 500,
                  backgroundColor: chartType === 'bar' ? '#FFFFFF' : 'transparent',
                  color: chartType === 'bar' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: chartType === 'bar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                막대 그래프
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: chartType === 'line' ? 700 : 500,
                  backgroundColor: chartType === 'line' ? '#FFFFFF' : 'transparent',
                  color: chartType === 'line' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: chartType === 'line' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                꺾은선 그래프
              </button>
              <button
                type="button"
                onClick={() => setChartType('cumulative')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: chartType === 'cumulative' ? 700 : 500,
                  backgroundColor: chartType === 'cumulative' ? '#FFFFFF' : 'transparent',
                  color: chartType === 'cumulative' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: chartType === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                누적 그래프
              </button>
            </div>
          </div>

          {/* 지표 필터 토글 칩 버튼 리스트 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem' }}>
            <MetricToggleButton
              label="순 교사"
              isActive={visibleMetrics.teachers}
              activeColor="#064E3B"
              onClick={() => toggleMetric('teachers')}
              tooltipData={{
                method: '1일 1회만 카운팅 (중복 제거)',
                standard: '당일 로그인한 전체 순수 교사 수 (신규+재방문)',
                purpose: '오늘 실제로 수업에 시스템을 활용하신 총 선생님 수'
              }}
            />
            <MetricToggleButton
              label="신규 교사"
              isActive={visibleMetrics.newTeachers}
              activeColor="#10B981"
              onClick={() => toggleMetric('newTeachers')}
              tooltipData={{
                method: '최초 로그인 시 1회만 카운팅',
                standard: '시스템 역사상 오늘 처음으로 로그인한 신규 교사',
                purpose: '새로운 학교 및 학급의 신규 교사 유입/확장 추이 분석'
              }}
            />
            <MetricToggleButton
              label="지속 교사"
              isActive={visibleMetrics.returningTeachers}
              activeColor="#0284C7"
              onClick={() => toggleMetric('returningTeachers')}
              tooltipData={{
                method: '기존 등록 계정 재로그인 집계',
                standard: '이전에 로그인한 이력이 있는 기존 선생님의 당일 재접속',
                purpose: '선생님들의 이탈 없는 지속 활용도 및 충성도 분석'
              }}
            />
            <MetricToggleButton
              label="신규 학생"
              isActive={visibleMetrics.newStudents}
              activeColor="#2563EB"
              onClick={() => toggleMetric('newStudents')}
              tooltipData={{
                method: '첫 학습활동 완료 시 1회 카운팅 (방안 A)',
                standard: '생애 최초로 문제 풀이를 완주한 신규 학생',
                purpose: '신규 학생 유입 및 실제 학습 참여 학생 증가 추이 분석'
              }}
            />
            <MetricToggleButton
              label="지속 학생"
              isActive={visibleMetrics.returningStudents}
              activeColor="#7C3AED"
              onClick={() => toggleMetric('returningStudents')}
              tooltipData={{
                method: '기존 참여 학생의 재풀이 집계',
                standard: '이전에 문제를 풀어본 적이 있는 학생의 당일 학습 활동',
                purpose: '학생들의 학습 지속성 및 일상 루틴 정착도 파악'
              }}
            />
            <MetricToggleButton
              label="순 방문자 (DAU)"
              isActive={visibleMetrics.visitors}
              activeColor="#0F172A"
              onClick={() => toggleMetric('visitors')}
              tooltipData={{
                method: '1일 1회만 카운팅 (중복 제거)',
                standard: '동일 기기/브라우저의 당일 재접속 및 새로고침 제외',
                purpose: '오늘 하루 접속한 실제 총 순수 사용자(학생+교사) 규모'
              }}
            />
            <MetricToggleButton
              label="풀이 완료 문항"
              isActive={visibleMetrics.solves}
              activeColor="#D97706"
              onClick={() => toggleMetric('solves')}
              tooltipData={{
                method: '실시간 누적 합산 (중복 수집)',
                standard: '학생들이 문제 풀이를 완주할 때마다 푼 문항 수만큼 실시간 누적',
                purpose: '일자별 전체 학급 학생들의 총 학습 활동량 변화 추이'
              }}
            />
          </div>
        </div>

        {/* 메인 SVG 캔버스 */}
        {dailyStats.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            해당 기간에 수집된 통계 데이터가 없습니다.
          </div>
        ) : (
          <div style={{ width: '100%', paddingBottom: '0.5rem' }}>
            <div style={{ width: '100%', height: '260px', position: 'relative' }}>
              <svg ref={containerRef} width="100%" height="220" style={{ overflow: 'visible' }}>
                {/* 수평 배경 그리드 및 Y축 눈금 */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 200 - ratio * 180;
                  return (
                    <g key={idx}>
                      <line x1={45} y1={y} x2={svgWidth - 25} y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x={37} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                        {Math.round(ratio * maxVisitors)}
                      </text>
                    </g>
                  );
                })}

                {/* 누적 그래프 polyline 레이어 */}
                {chartType === 'cumulative' && (
                  <g style={{ opacity: isMainAnimated ? 1 : 0, transition: 'opacity 0.5s ease-out' }}>
                    {visibleMetrics.solves && (
                      <polyline
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        points={getPolylinePoints((d) => d.cumSolves, maxSolves)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.visitors && (
                      <polyline
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.cumVisitors, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.returningStudents && (
                      <polyline
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.cumRetStudents, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.newStudents && (
                      <polyline
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2.6"
                        points={getPolylinePoints((d) => d.cumNewStudents, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.returningTeachers && (
                      <polyline
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.cumRetTeachers, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.newTeachers && (
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeDasharray="2 2"
                        points={getPolylinePoints((d) => d.cumNewTeachers, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.teachers && (
                      <polyline
                        fill="none"
                        stroke="#064E3B"
                        strokeWidth="2.8"
                        points={getPolylinePoints((d) => d.cumTeachers, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                  </g>
                )}

                {/* 꺾은선 그래프 polyline 레이어 */}
                {chartType === 'line' && (
                  <g style={{ opacity: isMainAnimated ? 1 : 0, transition: 'opacity 0.5s ease-out' }}>
                    {visibleMetrics.solves && (
                      <polyline
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="2.2"
                        strokeDasharray="4 4"
                        points={getPolylinePoints((d) => d.problemsSolved, maxSolves)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.visitors && (
                      <polyline
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.uniqueVisitors, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.returningStudents && (
                      <polyline
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.returningStudents || 0, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.newStudents && (
                      <polyline
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2.4"
                        points={getPolylinePoints((d) => d.newStudents || 0, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.returningTeachers && (
                      <polyline
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2.2"
                        points={getPolylinePoints((d) => d.returningTeachers || 0, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.newTeachers && (
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.2"
                        strokeDasharray="2 2"
                        points={getPolylinePoints((d) => d.newTeachers || 0, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                    {visibleMetrics.teachers && (
                      <polyline
                        fill="none"
                        stroke="#064E3B"
                        strokeWidth="2.6"
                        points={getPolylinePoints((d) => d.uniqueTeachers || 0, maxVisitors)}
                        style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                    )}
                  </g>
                )}

                {/* 개별 날짜 요소들 (막대 바 또는 꺾은선 데이터 포인트 원) */}
                {dailyStats.map((item, idx) => {
                  const dataset = chartType === 'cumulative' ? cumulativeDailyStats : dailyStats;
                  const currentItem = dataset[idx];
                  const totalBars = dataset.length;
                  const cx = getX(idx, totalBars);
                  const barWidth = Math.max(2, Math.min(6, Math.floor(250 / totalBars)));

                  const teacherVal = chartType === 'cumulative' ? (currentItem as any).cumTeachers : (item.uniqueTeachers || 0);
                  const newTeacherVal = chartType === 'cumulative' ? (currentItem as any).cumNewTeachers : (item.newTeachers || 0);
                  const retTeacherVal = chartType === 'cumulative' ? (currentItem as any).cumRetTeachers : (item.returningTeachers || 0);
                  const newStudentVal = chartType === 'cumulative' ? (currentItem as any).cumNewStudents : (item.newStudents || 0);
                  const retStudentVal = chartType === 'cumulative' ? (currentItem as any).cumRetStudents : (item.returningStudents || 0);
                  const visitorVal = chartType === 'cumulative' ? (currentItem as any).cumVisitors : (item.uniqueVisitors || 0);
                  const solveVal = chartType === 'cumulative' ? (currentItem as any).cumSolves : (item.problemsSolved || 0);

                  const teacherHeight = isMainAnimated ? (teacherVal / maxVisitors) * 180 : 0;
                  const newTeacherHeight = isMainAnimated ? (newTeacherVal / maxVisitors) * 180 : 0;
                  const retTeacherHeight = isMainAnimated ? (retTeacherVal / maxVisitors) * 180 : 0;
                  const newStudentHeight = isMainAnimated ? (newStudentVal / maxVisitors) * 180 : 0;
                  const retStudentHeight = isMainAnimated ? (retStudentVal / maxVisitors) * 180 : 0;
                  const visitorHeight = isMainAnimated ? (visitorVal / maxVisitors) * 180 : 0;
                  const solveHeight = isMainAnimated ? (solveVal / maxSolves) * 180 : 0;

                  const isHovered = hoveredDataIndex === idx;
                  const animDelay = `${Math.min(300, idx * 10)}ms`;

                  const showDateLabel = (
                    totalBars <= 14 ? true :
                    totalBars <= 31 ? (idx % 2 === 0 || idx === totalBars - 1) :
                    totalBars <= 60 ? (idx % 5 === 0 || idx === totalBars - 1) :
                    totalBars <= 120 ? (idx % 10 === 0 || idx === totalBars - 1) :
                    (idx % 20 === 0 || idx === totalBars - 1)
                  );

                  return (
                    <g
                      key={item.date}
                      onMouseEnter={() => setHoveredDataIndex(idx)}
                      onMouseLeave={() => setHoveredDataIndex(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* [A] 막대 그래프 모드 */}
                      {chartType === 'bar' ? (
                        <g>
                          {visibleMetrics.teachers && (
                            <rect
                              x={cx - 15}
                              y={200 - teacherHeight}
                              width={barWidth}
                              height={Math.max(2, teacherHeight)}
                              rx="1.5"
                              fill={isHovered ? '#047857' : '#064E3B'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.newTeachers && (
                            <rect
                              x={cx - 10}
                              y={200 - newTeacherHeight}
                              width={barWidth}
                              height={Math.max(2, newTeacherHeight)}
                              rx="1.5"
                              fill={isHovered ? '#34D399' : '#10B981'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.returningTeachers && (
                            <rect
                              x={cx - 5}
                              y={200 - retTeacherHeight}
                              width={barWidth}
                              height={Math.max(2, retTeacherHeight)}
                              rx="1.5"
                              fill={isHovered ? '#38BDF8' : '#0284C7'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.newStudents && (
                            <rect
                              x={cx + 0}
                              y={200 - newStudentHeight}
                              width={barWidth}
                              height={Math.max(2, newStudentHeight)}
                              rx="1.5"
                              fill={isHovered ? '#60A5FA' : '#2563EB'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.returningStudents && (
                            <rect
                              x={cx + 5}
                              y={200 - retStudentHeight}
                              width={barWidth}
                              height={Math.max(2, retStudentHeight)}
                              rx="1.5"
                              fill={isHovered ? '#A78BFA' : '#7C3AED'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.visitors && (
                            <rect
                              x={cx + 10}
                              y={200 - visitorHeight}
                              width={barWidth}
                              height={Math.max(2, visitorHeight)}
                              rx="1.5"
                              fill={isHovered ? '#334155' : '#0F172A'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                          {visibleMetrics.solves && (
                            <rect
                              x={cx + 15}
                              y={200 - solveHeight}
                              width={barWidth}
                              height={Math.max(2, solveHeight)}
                              rx="1.5"
                              fill={isHovered ? '#FBBF24' : '#D97706'}
                              style={{
                                transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), y 0.5s cubic-bezier(0.16, 1, 0.3, 1), fill 0.15s ease',
                                transitionDelay: animDelay
                              }}
                            />
                          )}
                        </g>
                      ) : (
                        /* [B] 꺾은선 & 누적 그래프 데이터 포인트 원 */
                        <g>
                          {visibleMetrics.teachers && (
                            <circle
                              cx={cx}
                              cy={200 - teacherHeight}
                              r={isHovered ? 5 : isMainAnimated ? 3.5 : 0}
                              fill="#064E3B"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.newTeachers && (
                            <circle
                              cx={cx}
                              cy={200 - newTeacherHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#10B981"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.returningTeachers && (
                            <circle
                              cx={cx}
                              cy={200 - retTeacherHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#0284C7"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.newStudents && (
                            <circle
                              cx={cx}
                              cy={200 - newStudentHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#2563EB"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.returningStudents && (
                            <circle
                              cx={cx}
                              cy={200 - retStudentHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#7C3AED"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.visitors && (
                            <circle
                              cx={cx}
                              cy={200 - visitorHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#0F172A"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                          {visibleMetrics.solves && (
                            <circle
                              cx={cx}
                              cy={200 - solveHeight}
                              r={isHovered ? 4.5 : isMainAnimated ? 3 : 0}
                              fill="#D97706"
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.3s ease', transitionDelay: animDelay }}
                            />
                          )}
                        </g>
                      )}

                      {/* X축 날짜 텍스트 (호버 시 또는 스마트 표시) */}
                      {(showDateLabel || isHovered) && (
                        <text
                          x={cx}
                          y="220"
                          textAnchor="middle"
                          fontSize={totalBars > 30 ? '9' : '10'}
                          fontWeight={isHovered ? 700 : 500}
                          fill={isHovered ? 'var(--text-primary)' : '#64748B'}
                        >
                          {item.date.substring(5)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* 🎯 호버 데이터 툴팁 카드 */}
              {hoveredDataIndex !== null && dailyStats[hoveredDataIndex] && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: `${Math.min(svgWidth - 170, Math.max(10, getX(hoveredDataIndex, dailyStats.length) - 80))}px`,
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', color: '#94A3B8' }}>
                    {dailyStats[hoveredDataIndex].date} {chartType === 'cumulative' && '(누적 성장)'}
                  </div>
                  {visibleMetrics.teachers && (
                    <div>순 교사: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumTeachers : dailyStats[hoveredDataIndex].uniqueTeachers || 0}명</strong></div>
                  )}
                  {visibleMetrics.newTeachers && (
                    <div>신규 교사: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumNewTeachers : dailyStats[hoveredDataIndex].newTeachers || 0}명</strong></div>
                  )}
                  {visibleMetrics.returningTeachers && (
                    <div>지속 교사: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumRetTeachers : dailyStats[hoveredDataIndex].returningTeachers || 0}명</strong></div>
                  )}
                  {visibleMetrics.newStudents && (
                    <div>신규 학생: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumNewStudents : dailyStats[hoveredDataIndex].newStudents || 0}명</strong></div>
                  )}
                  {visibleMetrics.returningStudents && (
                    <div>지속 학생: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumRetStudents : dailyStats[hoveredDataIndex].returningStudents || 0}명</strong></div>
                  )}
                  {visibleMetrics.visitors && (
                    <div>순 방문자: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumVisitors : dailyStats[hoveredDataIndex].uniqueVisitors}명</strong></div>
                  )}
                  {visibleMetrics.solves && (
                    <div>풀이 완료: <strong>{chartType === 'cumulative' ? (cumulativeDailyStats[hoveredDataIndex] as any).cumSolves : dailyStats[hoveredDataIndex].problemsSolved}문항</strong></div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🧭 하단 2열 그리드: 시간대별 집중도 & 요일별 학습 패턴 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* 카드 1: 시간대별 접속 집중도 (0시 ~ 23시) */}
        <div className="card" style={{ padding: '1.4rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', minHeight: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  시간대별 접속 집중도 (0시 ~ 23시)
                </h3>
                <DevInfoTooltip data={{
                  method: '0시~23시 시간대별 누적 합산',
                  standard: '각 시간대별로 발생한 모든 페이지 접속 및 문제 풀이 건수',
                  purpose: '아침 8~9시 아침활동 피크 등 시간대별 서비스 활용 패턴 분석'
                }} />
              </div>
              {hoveredHourlyIndex !== null && hourlyStats[hoveredHourlyIndex] ? (
                <div style={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}>
                  <span style={{ fontWeight: 700, color: '#A7F3D0' }}>{hoveredHourlyIndex}시</span>
                  <span>방문: <strong>{hourlyStats[hoveredHourlyIndex].visits}회</strong></span>
                  <span>풀이: <strong>{hourlyStats[hoveredHourlyIndex].solves}문항</strong></span>
                  {hoveredHourlyIndex >= 8 && hoveredHourlyIndex <= 9 && (
                    <span style={{ color: '#FCD34D', fontWeight: 700 }}>(피크)</span>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>24시간 분포</span>
              )}
            </div>

            {/* 24시간 막대 차트 */}
            <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', gap: '3px', paddingTop: '10px' }}>
              {hourlyStats.map((h) => {
                const ratio = maxHourly > 0 ? (h.visits / maxHourly) * 100 : 0;
                const isPeak = h.hour >= 8 && h.hour <= 9;
                const isHovered = hoveredHourlyIndex === h.hour;
                return (
                  <div
                    key={h.hour}
                    onMouseEnter={() => setHoveredHourlyIndex(h.hour)}
                    onMouseLeave={() => setHoveredHourlyIndex(null)}
                    style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '100%',
                      height: `${isAuxAnimated ? Math.max(4, ratio) : 0}%`,
                      backgroundColor: isHovered ? (isPeak ? '#047857' : '#64748B') : (isPeak ? '#064E3B' : '#E2E8F0'),
                      borderRadius: '2px',
                      transition: 'height 0.5s ease-out, background-color 0.15s ease',
                      transitionDelay: `${h.hour * 10}ms`
                    }} />
                  </div>
                );
              })}
            </div>

            {/* 24시간 X축 라벨 */}
            <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
              {hourlyStats.map((h) => {
                const isPeak = h.hour >= 8 && h.hour <= 9;
                const isHovered = hoveredHourlyIndex === h.hour;
                return (
                  <div
                    key={h.hour}
                    onMouseEnter={() => setHoveredHourlyIndex(h.hour)}
                    onMouseLeave={() => setHoveredHourlyIndex(null)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '9px',
                      color: isHovered ? '#0F172A' : isPeak ? '#064E3B' : '#94A3B8',
                      fontWeight: isHovered || isPeak ? 700 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {h.hour % 3 === 0 ? h.hour : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 카드 2: 요일별 학습 패턴 (월 ~ 일) */}
        <div className="card" style={{ padding: '1.4rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', minHeight: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  요일별 학습 패턴 (월 ~ 일)
                </h3>
                <DevInfoTooltip data={{
                  method: '월~일 요일별 누적 및 평균 집계',
                  standard: '등교 평일(월~금)과 주말(토~일)의 접속 및 학습 활동량',
                  purpose: '요일별 학습 연속성 확인 및 수업에 방해 없는 안전한 점검/배포 시점 결정'
                }} />
              </div>
              {hoveredWeekdayIndex !== null && weekdayStats[hoveredWeekdayIndex] ? (
                <div style={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}>
                  <span style={{ fontWeight: 700, color: '#A7F3D0' }}>{weekdayStats[hoveredWeekdayIndex].day}요일</span>
                  <span>교사: <strong>{weekdayStats[hoveredWeekdayIndex].teachers}명</strong></span>
                  <span>방문: <strong>{weekdayStats[hoveredWeekdayIndex].visitors}명</strong></span>
                  <span>풀이: <strong>{weekdayStats[hoveredWeekdayIndex].solves}문항</strong></span>
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>주간 7일 추이</span>
              )}
            </div>

            {/* 요일별 수평 게이지 바 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {weekdayStats.map((item, idx) => {
                const maxVal = Math.max(...weekdayStats.map((w) => w.visitors), 1);
                const widthPercent = (item.visitors / maxVal) * 100;
                const isWeekday = item.day !== '토' && item.day !== '일';
                const isHovered = hoveredWeekdayIndex === idx;

                return (
                  <div
                    key={item.day}
                    onMouseEnter={() => setHoveredWeekdayIndex(idx)}
                    onMouseLeave={() => setHoveredWeekdayIndex(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.8rem',
                      padding: '3px 6px',
                      borderRadius: '6px',
                      backgroundColor: isHovered ? '#F1F5F9' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '20px', fontWeight: 700, color: isWeekday ? 'var(--text-primary)' : '#94A3B8' }}>
                      {item.day}
                    </span>
                    <div style={{ flex: 1, height: '10px', backgroundColor: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${isAuxAnimated ? widthPercent : 0}%`,
                        height: '100%',
                        backgroundColor: isWeekday ? (isHovered ? '#047857' : '#064E3B') : '#94A3B8',
                        borderRadius: '5px',
                        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease',
                        transitionDelay: `${idx * 25}ms`
                      }} />
                    </div>
                    <span style={{ width: '85px', textAlign: 'right', fontSize: '0.75rem', color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {item.visitors}명 ({item.solves}문항)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
