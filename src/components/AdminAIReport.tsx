import React, { useState, useEffect } from 'react';
import { 
  getStudentSubmissions, 
  getProblem, 
  getDailyProblems,
  getAllStudentSubmissions,
  saveComprehensiveReport,
  getComprehensiveReport,
  getAllProblems
} from '../db';
import { Student, Problem, Submission } from '../types';
import { getActiveGeminiApiKey } from '../config/appConfig';

interface AdminAIReportProps {
  student: Student;
  date: string;
  onBack: () => void;
}

export const AdminAIReport: React.FC<AdminAIReportProps> = ({
  student,
  date,
  onBack,
}) => {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dailyProblems, setDailyProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [aiReport, setAiReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [error, setError] = useState('');

  // 🌟 누적 종합 학습 분석 리포트 관련 신규 상태 추가
  const [activeAnalysisType, setActiveAnalysisType] = useState<'single' | 'comprehensive'>('single');
  const [comprehensiveReport, setComprehensiveReport] = useState<string>('');
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [isGeneratingComprehensive, setIsGeneratingComprehensive] = useState(false);
  const [isLoadingComprehensive, setIsLoadingComprehensive] = useState(false);

  // 1. 해당 날짜에 배포된 모든 문제 꾸러미(유형)들 로드
  useEffect(() => {
    const loadProblems = async () => {
      setIsLoading(true);
      setError('');
      try {
        const probs = await getDailyProblems(date);
        setDailyProblems(probs);
        if (probs.length > 0) {
          setSelectedProblemId(probs[0].id);
          setProblem(probs[0]);
        }
      } catch (err) {
        console.error(err);
        setError('배포된 문제 리스트를 가져오는 도중 에러가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    loadProblems();
  }, [date]);

  // 2. 선택된 문제 꾸러미 ID가 변경될 때마다 학생의 상세 제출 내역 조회
  useEffect(() => {
    if (!selectedProblemId) return;

    const loadSubmissions = async () => {
      setIsLoading(true);
      setError('');
      try {
        const subs = await getStudentSubmissions(selectedProblemId, student.classId, student.id);
        setSubmissions(subs);

        const currentProb = dailyProblems.find(p => p.id === selectedProblemId);
        if (currentProb) {
          setProblem(currentProb);
        }
      } catch (err) {
        console.error(err);
        setError('학생의 제출 상세 기록을 로드하는 도중 에러가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSubmissions();
  }, [selectedProblemId, student.id, dailyProblems]);

  // 🌟 3. 종합 분석 모드로 전환될 때 전체 누적 데이터 로드
  useEffect(() => {
    if (activeAnalysisType !== 'comprehensive') return;

    const loadComprehensiveData = async () => {
      setIsLoadingComprehensive(true);
      try {
        const subs = await getAllStudentSubmissions(student.classId, student.id);
        setAllSubmissions(subs);

        const probs = await getAllProblems();
        const filteredProbs = probs.filter(p => (p.targetClasses || ['1반']).includes(student.classId));
        setAllProblems(filteredProbs);

        const cached = await getComprehensiveReport(student.classId, student.id);
        if (cached) {
          setComprehensiveReport(cached.reportText);
        } else {
          setComprehensiveReport('');
        }
      } catch (err) {
        console.error('종합 통계 로드 오류:', err);
      } finally {
        setIsLoadingComprehensive(false);
      }
    };

    loadComprehensiveData();
  }, [activeAnalysisType, student.id, student.classId]);

  // Gemini API를 이용한 분석 리포트 생성
  const generateAIReport = async () => {
    const activeApiKey = getActiveGeminiApiKey();
    
    if (!activeApiKey || activeApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      alert('Gemini API 키가 세팅되지 않았습니다. 상단 환경설정(⚙️) 메뉴에서 Gemini API 키를 입력해 주세요.');
      return;
    }

    setIsGeneratingAI(true);
    setAiReport('');

    try {
      // 분석을 위한 문제 및 제출 데이터 요약
      const dataSummary = {
        student: `${student.id}번 ${student.name}`,
        chapter: problem?.chapter || '미정 단원',
        type: problem?.type || '일반 유형',
        questionsCount: problem?.questions.length || 0,
        submissions: submissions.map(sub => ({
          questionId: sub.questionId,
          attempts: sub.attempts,
          isCompleted: sub.isCompleted,
          history: sub.history.map(h => ({
            submittedValue: h.submittedValue,
            isCorrect: h.isCorrect,
            elapsedTime: `${h.elapsedTime}초`,
            submittedAt: h.submittedAt
          }))
        }))
      };

      const prompt = `
당신은 대한민국 초등 수학 교육 전문가이자 학급 개별화 지도를 돕는 친절한 AI 보조교사입니다.
다음은 아침활동 시간에 초등학생이 수학 문제를 풀고 제출한 실시간 학습 이력 데이터입니다. 
이 데이터를 꼼꼼히 분석하여 담임 선생님이 학생의 수준을 직관적으로 이해하고 맞춤형 1:1 피드백을 줄 수 있도록 분석 리포트를 작성해 주세요.

[학습 데이터]
- 분석 대상: ${dataSummary.student}
- 단원명: ${dataSummary.chapter}
- 문제 유형: ${dataSummary.type}
- 총 문항수: ${dataSummary.questionsCount}개
- 학생 상세 제출 기록 (JSON): 
${JSON.stringify(dataSummary.submissions, null, 2)}

[요청 사항 및 서식 규칙 (극히 중요!)]
바쁜 담임 선생님이 한눈에 파악할 수 있도록 반드시 다음 구조에 따라 친절하고 상냥한 경어체 어조로 한글로 답변해 주세요.

1. 전반적인 학습 요약:
   - 총 문제 중 해결 문항 수, 평균 시도 횟수, 평균 풀이 시간을 담백하고 짧게 요약해 주세요.
2. 오답 및 풀이 특징:
   - 학생이 적은 구체적 오답들을 보고, 단순 계산 실수인지 개념 혼동인지 취약 유형을 2줄 이내로 간결히 짚어주세요.
3. 현재 학습 수준:
   - 이 단원의 개념 이해도를 진단(상/중/하)하고 보완 포인트를 2줄 이내로 요약해 주세요.
4. 개별 맞춤 지도 조언 (핵심):
   - 내일 교실에서 이 학생에게 던질 구체적인 질문 발문이나 처방 피드백을 단 2가지로 요약하여 짧게 적어주세요.

★가독성 및 서식 규칙:
- 별표(**)나 샵(#), 언더바(_) 등 지저분하게 가독성을 해치는 마크다운 기호를 절대 사용하지 마세요. 강조나 볼드 처리를 하고 싶다면 그냥 평문 한글 텍스트나 줄바꿈으로만 정돈해 주세요.
- 모든 서술은 불필요한 인사말이나 서론을 완전히 배제하고, 핵심 요점 위주로 각 항목당 2-3줄 이내의 매우 간결한 요약문 형태로만 출력하세요.
`;

      let responseText = '';
      
      // 🚀 1순위: Gemini 3.5 Flash 호출
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${activeApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      // 2순위: Gemini 3.5 Pro 폴백
      if (!response.ok) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-pro:generateContent?key=${activeApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || response.statusText || `API 전송 에러! 상태코드: ${response.status}`);
      }

      const resData = await response.json();
      responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!responseText) {
        throw new Error('API 응답에서 텍스트 결과를 추출할 수 없습니다.');
      }

      setAiReport(responseText);
    } catch (err) {
      console.error(err);
      alert('오류 상세: ' + (err instanceof Error ? err.message : String(err)) + '\n\nAI 분석 리포트를 생성하는 도중 오류가 발생했습니다. API 키나 네트워크를 확인해 주세요.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // 🌟 전체 누적 데이터를 기반으로 종합 AI 분석 리포트 생성
  const generateComprehensiveAIReport = async () => {
    const activeApiKey = getActiveGeminiApiKey();
    
    if (!activeApiKey || activeApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      alert('Gemini API 키가 세팅되지 않았습니다. 상단 환경설정(⚙️) 메뉴에서 Gemini API 키를 입력해 주세요.');
      return;
    }

    setIsGeneratingComprehensive(true);
    setComprehensiveReport('');

    try {
      // 분석 대상이 될 과제별 이력 가공
      const historySummary = allProblems.map(p => {
        const problemSubs = allSubmissions.filter(s => s.problemId === p.id && s.questionId !== 0);
        const completedCount = problemSubs.filter(s => s.isCompleted).length;
        const totalQuestions = p.questions.length;
        const attempts = problemSubs.reduce((sum, s) => sum + s.attempts, 0);
        return {
          date: p.date,
          grade: p.grade,
          chapter: p.chapter,
          type: p.type,
          result: `${completedCount}/${totalQuestions} 완료`,
          attempts: `${attempts}회 시도`
        };
      });

      const prompt = `
당신은 대한민국 초등 수학 교육 전문가이자 학급 개별화 지도를 돕는 친절한 AI 보조교사입니다.
다음은 초등학생이 여태까지 참여한 전체 아침활동 수학 과제들의 누적 수행 실적 데이터입니다.
이 누적 데이터를 면밀히 분석하여 학생의 학습 추이, 단원별 취약점, 학업 성실성 상태, 그리고 담임 교사가 이 학생을 효과적으로 조력하기 위한 1:1 진단 처방 및 미래 성장 지원 팁을 기술한 [누적 종합 AI 학습 리포트]를 작성해 주세요.

[누적 학습 데이터]
- 분석 대상: ${student.id}번 ${student.name} 학생
- 누적 과제 이력 및 성적 목록 (JSON):
${JSON.stringify(historySummary, null, 2)}

[요청 사항 및 서식 규칙 (극히 중요!)]
바쁜 담임 선생님이 한눈에 파악할 수 있도록 반드시 다음 구조에 따라 친절하고 상냥한 경어체 어조로 한글로 답변해 주세요.

1. 누적 학습 성과 및 성실성 진단:
   - 그동안 완료도 추이, 평균 시도 횟수를 토대로 학습 끈기와 태도를 2-3줄로 담백하게 요약해 주세요.
2. 단원별 강점과 취약점 분석:
   - 강점 단원과 취약 단원/유형(예: 단순계산 vs 문장제 등)을 2-3줄 이내로 명확히 분석해 주세요.
3. 향후 성장을 위한 개별 맞춤 처방 (핵심):
   - 기초학력 증진을 위해 현장에서 당장 실천 가능한 맞춤형 조언을 딱 2가지로 요약하여 짧게 기술해 주세요.

★가독성 및 서식 규칙:
- 별표(**)나 샵(#), 언더바(_) 등 지저분하게 가독성을 해치는 마크다운 기호를 절대 사용하지 마세요. 강조나 볼드 처리를 하고 싶다면 그냥 평문 한글 텍스트나 줄바꿈으로만 정돈해 주세요.
- 모든 서술은 불필요한 인사말이나 서론을 완전히 배제하고, 핵심 요점 위주로 각 항목당 2-3줄 이내의 매우 간결한 요약문 형태로만 출력하세요.
`;

      let responseText = '';
      // 🚀 1순위: Gemini 3.5 Flash 호출
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${activeApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      // 2순위: Gemini 3.5 Pro 폴백
      if (!response.ok) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-pro:generateContent?key=${activeApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || response.statusText || `API 전송 에러! 상태코드: ${response.status}`);
      }

      const resData = await response.json();
      responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!responseText) {
        throw new Error('API 응답에서 텍스트 결과를 추출할 수 없습니다.');
      }

      setComprehensiveReport(responseText);
      // DB에 캐시 저장하여 재호출 낭비 방지!
      await saveComprehensiveReport(student.classId, student.id, responseText);
    } catch (err) {
      console.error(err);
      alert('오류 상세: ' + (err instanceof Error ? err.message : String(err)) + '\n\n종합 AI 리포트 생성에 실패했습니다.');
    } finally {
      setIsGeneratingComprehensive(false);
    }
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '5rem' }}>상세 분석 데이터를 가져오는 중...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ border: '1px solid var(--color-error)' }}>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '1rem' }}>뒤로 가기</button>
      </div>
    );
  }

  // 총 문항 완료 비율 계산
  const totalQuestions = problem?.questions.length || 0;
  const completedCount = submissions.filter(s => s.isCompleted).length;
  const totalAttempts = submissions.reduce((acc, cur) => acc + cur.attempts, 0);

  return (
    <div>
      {/* 최상단 네비게이션 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          현황판으로 돌아가기
        </button>
        <span className="badge badge-indigo">
          {student.classId} {student.name} 학생 분석
        </span>
      </div>

      {/* 🌟 분석 유형 전환 탭 (개별 과제 vs 누적 종합) */}
      <div style={{ 
        display: 'flex', 
        gap: '0.35rem', 
        marginBottom: '1.5rem', 
        backgroundColor: '#e2e8f0', 
        padding: '0.3rem', 
        borderRadius: '10px', 
        width: 'fit-content' 
      }}>
        <button
          onClick={() => setActiveAnalysisType('single')}
          className={`btn ${activeAnalysisType === 'single' ? 'btn-primary btn-point' : ''}`}
          style={{ 
            padding: '0.45rem 1rem', 
            fontSize: '0.85rem', 
            borderRadius: '8px', 
            border: 'none', 
            backgroundColor: activeAnalysisType === 'single' ? undefined : 'transparent', 
            color: activeAnalysisType === 'single' ? undefined : 'var(--text-secondary)',
            fontWeight: 700
          }}
        >
          개별 과제 분석
        </button>
        <button
          onClick={() => setActiveAnalysisType('comprehensive')}
          className={`btn ${activeAnalysisType === 'comprehensive' ? 'btn-primary btn-point' : ''}`}
          style={{ 
            padding: '0.45rem 1rem', 
            fontSize: '0.85rem', 
            borderRadius: '8px', 
            border: 'none', 
            backgroundColor: activeAnalysisType === 'comprehensive' ? undefined : 'transparent', 
            color: activeAnalysisType === 'comprehensive' ? undefined : 'var(--text-secondary)',
            fontWeight: 700
          }}
        >
          누적 종합 AI 리포트
        </button>
      </div>

      {activeAnalysisType === 'single' ? (
        // ==========================================
        // 탭 A: 개별 과제별 분석 화면
        // ==========================================
        <div>
          {/* 동일 날짜 여러 세트 배포 시 분석할 문제 세트 스위칭 토글 바 */}
          {dailyProblems.length > 1 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.5rem', 
              marginBottom: '1.5rem', 
              padding: '0.75rem 1rem', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color)',
              alignItems: 'center',
              boxShadow: 'var(--shadow-bento)'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                분석할 문제 세트 선택:
              </span>
              {dailyProblems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProblemId(p.id)}
                  className={`btn ${selectedProblemId === p.id ? 'btn-primary btn-point' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}
                >
                  {p.grade} - {p.type}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
            {/* 왼쪽: 단일 과제 풀이 이력 타임라인 */}
            <div>
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>
                  {student.id}번 {student.name}의 제출 기록
                </h3>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>완료 여부</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: completedCount === totalQuestions ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {completedCount} / {totalQuestions}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>총 시도 횟수</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                      {totalAttempts}회
                    </div>
                  </div>
                </div>

                {totalQuestions === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>배포된 문제가 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {problem?.questions.map((q) => {
                      const studentSub = submissions.find(s => s.questionId === q.id);
                      
                      return (
                        <div 
                          key={q.id} 
                          style={{ 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px', 
                            padding: '1rem',
                            backgroundColor: studentSub?.isCompleted ? 'rgba(16,185,129,0.01)' : 'rgba(0,0,0,0.01)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>Q{q.id}. {q.questionText}</span>
                            {studentSub ? (
                              studentSub.isCompleted ? (
                                <span className="badge badge-green">완료</span>
                              ) : (
                                <span className="badge badge-red">진행중</span>
                              )
                            ) : (
                              <span className="badge badge-gray">미시작</span>
                            )}
                          </div>

                          {studentSub ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <div style={{ marginBottom: '0.25rem' }}>
                                • 시도 횟수: <strong>{studentSub.attempts}회</strong>
                              </div>
                              
                              <div style={{ marginTop: '0.5rem', backgroundColor: '#ffffff', border: '1px solid #f3f4f6', borderRadius: '6px', padding: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>시도 히스토리</div>
                                {studentSub.history.map((hist, hIdx) => (
                                  <div 
                                    key={hIdx} 
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      fontSize: '0.8rem',
                                      padding: '0.15rem 0',
                                      color: hist.isCorrect ? 'var(--color-success)' : 'var(--color-error)'
                                    }}
                                  >
                                    <span>시도 {hIdx + 1}: "{hist.submittedValue}"</span>
                                    <span>{hist.elapsedTime}초 ({hist.isCorrect ? 'O' : 'X'})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>아직 풀지 않았습니다.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽: AI 단일 리포트 작성 판넬 */}
            <div>
              <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '1.05rem' }}>
                  Gemini AI 맞춤 분석 리포트
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  선택한 개별 과제에서의 오답 이력과 고민 시간을 정밀 분석하여 학업 성취도를 진단합니다.
                </p>

                {!aiReport && !isGeneratingAI ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>아직 생성된 리포트가 없습니다.</p>
                    <button 
                      onClick={generateAIReport} 
                      className="btn btn-primary btn-point"
                      disabled={submissions.length === 0}
                      style={{ padding: '0.75rem 1.5rem' }}
                    >
                      AI 학습 리포트 생성
                    </button>
                    {submissions.length === 0 && (
                      <p style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        * 제출한 기록이 있어야 분석이 가능합니다.
                      </p>
                    )}
                  </div>
                ) : isGeneratingAI ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px' }}>
                    <div style={{
                      border: '4px solid rgba(6, 78, 59, 0.1)',
                      borderLeft: '4px solid var(--color-point)',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '1rem'
                    }}></div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Gemini AI가 학습 기록을 분석 중입니다...
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ 
                      backgroundColor: 'rgba(6, 78, 59, 0.03)', 
                      border: '1px solid var(--color-point-light)', 
                      borderRadius: '8px', 
                      padding: '1.5rem',
                      fontSize: '0.9rem',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {aiReport}
                    </div>
                    
                    <button 
                      onClick={generateAIReport} 
                      className="btn btn-secondary" 
                      style={{ marginTop: '1rem', width: '100%', padding: '0.6rem' }}
                    >
                      리포트 다시 생성하기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // 탭 B: 누적 종합 AI 리포트 화면
        // ==========================================
        <div className="grid grid-cols-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
          {/* 왼쪽: 전체 배포 과제 누적 학습 현황판 */}
          <div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>
                {student.name} 학생의 누적 전체 학습 현황
              </h3>

              {isLoadingComprehensive ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>누적 데이터를 불러오는 중...</div>
              ) : allProblems.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>배포된 전체 과제가 없습니다.</p>
              ) : (
                <div>
                  {/* 누적 통계 상단 요약 박스 */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>참여한 과제 수</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-point)' }}>
                        {allProblems.length}개
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>누적 총 시도 횟수</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {allSubmissions.filter(s => s.questionId !== 0).reduce((sum, s) => sum + s.attempts, 0)}회
                      </div>
                    </div>
                  </div>

                  {/* 📊 신설: 총 과제 성공률 추이 차트 패널 */}
                  {allProblems.length > 0 && (() => {
                    const totalCumulativeQuestions = allProblems.reduce((sum, p) => sum + p.questions.length, 0);
                    const completedCumulativeQuestions = allSubmissions.filter(s => s.questionId !== 0 && s.isCompleted).length;
                    const cumulativePercent = totalCumulativeQuestions > 0 ? Math.round((completedCumulativeQuestions / totalCumulativeQuestions) * 100) : 0;
                    
                    return (
                      <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#fafafa', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            총 과제 성공률 (누적 종합 완료율)
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-point)' }}>
                            {cumulativePercent}%
                          </span>
                        </div>
                        <div style={{ height: '12px', backgroundColor: '#e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${cumulativePercent}%`, height: '100%', backgroundColor: 'var(--color-point)', borderRadius: '6px' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'right' }}>
                          총 {totalCumulativeQuestions}개 문항 중 {completedCumulativeQuestions}개 완료
                        </div>
                      </div>
                    );
                  })()}

                  {/* 스크롤 가능한 과제 목록 리스트 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {allProblems.map((p) => {
                      const problemSubs = allSubmissions.filter(s => s.problemId === p.id && s.questionId !== 0);
                      const completedCount = problemSubs.filter(s => s.isCompleted).length;
                      const totalQuestions = p.questions.length;
                      const attempts = problemSubs.reduce((sum, s) => sum + s.attempts, 0);
                      const isAllDone = completedCount >= totalQuestions && totalQuestions > 0;

                      return (
                        <div 
                          key={p.id} 
                          style={{ 
                            padding: '0.85rem', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '10px', 
                            backgroundColor: isAllDone ? 'rgba(16,185,129,0.01)' : '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.date} 배포</span>
                            {isAllDone ? (
                              <span className="badge badge-green" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>완료</span>
                            ) : (
                              <span className="badge badge-indigo" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>진행중</span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                            {p.grade} / {p.chapter}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                            <span>진도율: <strong>{completedCount} / {totalQuestions}</strong></span>
                            <span>시도: <strong>{attempts}회</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: AI 누적 종합 리포트 작성 판넬 */}
          <div>
            <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
              <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '1.05rem' }}>
                누적 종합 AI 학습 리포트
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                학생의 지난 수학 모든 아침활동 이력을 결합 분석하여 성실도, 단원별 취약점, 맞춤식 교실 지도 처방을 도출합니다.
              </p>

              {isLoadingComprehensive ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>종합 리포트 상태를 조회하고 있습니다...</div>
              ) : !comprehensiveReport && !isGeneratingComprehensive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>아직 종합 리포트가 생성되지 않았습니다.</p>
                  <button 
                    onClick={generateComprehensiveAIReport} 
                    className="btn btn-primary btn-point"
                    disabled={allProblems.length === 0}
                    style={{ padding: '0.75rem 1.5rem' }}
                  >
                    누적 종합 AI 리포트 생성
                  </button>
                </div>
              ) : isGeneratingComprehensive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px' }}>
                  <div style={{
                    border: '4px solid rgba(6, 78, 59, 0.1)',
                    borderLeft: '4px solid var(--color-point)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '1rem'
                  }}></div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Gemini AI가 누적 학습 기록을 분석 중입니다...
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    잠시만 기다려 주세요 (약 5초 소요)
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ 
                    backgroundColor: 'rgba(6, 78, 59, 0.03)', 
                    border: '1px solid var(--color-point-light)', 
                    borderRadius: '8px', 
                    padding: '1.5rem',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {comprehensiveReport}
                  </div>
                  
                  <button 
                    onClick={generateComprehensiveAIReport} 
                    className="btn btn-secondary" 
                    style={{ marginTop: '1rem', width: '100%', padding: '0.6rem' }}
                  >
                    리포트 다시 생성하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 키프레임 애니메이션용 스타일 태그 */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
