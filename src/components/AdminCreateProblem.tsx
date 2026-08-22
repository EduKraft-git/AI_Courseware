import React, { useState, useEffect } from 'react';
import { saveProblem, getProblem, getDailyProblems, getAllClasses } from '../db';
import { Problem, Question, SchoolClass } from '../types';
import { CHAPTER_STANDARDS_MAP } from '../constants/mathStandards';

interface AdminCreateProblemProps {
  onBack: () => void;
  initialDate?: string;
  initialProblemId?: string | null; // 수정 모드 진입 시 특정 문제 꾸러미 고유 ID 전달용
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
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="도움말 보기"
      >
        ⓘ
      </button>
      {isOpen && (
        <div className="info-tooltip-popover">
          {text}
        </div>
      )}
    </span>
  );
};

export const AdminCreateProblem: React.FC<AdminCreateProblemProps> = ({ onBack, initialDate, initialProblemId }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [problemId, setProblemId] = useState<string | null>(null); // 현재 편집 중인 고유 문제 ID
  const [grade, setGrade] = useState('6학년');
  const [chapter, setChapter] = useState('분수의 나눗셈');
  const [questionsCount, setQuestionsCount] = useState(10);
  const [problemType, setProblemType] = useState('단순계산문제');
  const [targetClasses, setTargetClasses] = useState<string[]>(['1반']); // 배포 대상 반 목록
  const [classList, setClassList] = useState<SchoolClass[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [inspectIndex, setInspectIndex] = useState(0);

  // 프리뷰 문항 수 변동 시 검수 인덱스 범위 방어
  useEffect(() => {
    if (inspectIndex >= previewQuestions.length) {
      setInspectIndex(Math.max(0, previewQuestions.length - 1));
    }
  }, [previewQuestions.length]);

  // 한국 시간 기준 YYYY-MM-DD
  const getTodayString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  useEffect(() => {
    setSelectedDate(initialDate || getTodayString());
    setProblemId(initialProblemId || null);
  }, [initialDate, initialProblemId]);

  // 🌟 컴포넌트 마운트 시 동적 학급 목록 로딩
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const list = await getAllClasses();
        setClassList(list);
        if (list.length > 0) {
          setTargetClasses([list[0].name]);
        }
      } catch (e) {
        console.error('문제 배포 반 로드 에러:', e);
      }
    };
    fetchClasses();
  }, []);

  // 📚 아이스크림 초등 수학 교과서 기준 학년별 단원 목록 매핑 (1학기 & 2학기 전 단원)
  const chapterOptions: { [key: string]: string[] } = {
    '3학년': [
      '[1학기] 1. 덧셈과 뺄셈',
      '[1학기] 2. 평면도형',
      '[1학기] 3. 나눗셈',
      '[1학기] 4. 곱셈',
      '[1학기] 5. 길이와 시간',
      '[1학기] 6. 분수와 소수',
      '[2학기] 1. 곱셈',
      '[2학기] 2. 나눗셈',
      '[2학기] 3. 원',
      '[2학기] 4. 분수',
      '[2학기] 5. 들이와 무게',
      '[2학기] 6. 자료의 정리'
    ],
    '4학년': [
      '[1학기] 1. 큰 수',
      '[1학기] 2. 각도',
      '[1학기] 3. 곱셈과 나눗셈',
      '[1학기] 4. 평면도형의 이동',
      '[1학기] 5. 막대그래프',
      '[1학기] 6. 규칙 찾기',
      '[2학기] 1. 분수의 덧셈과 뺄셈',
      '[2학기] 2. 삼각형',
      '[2학기] 3. 소수의 덧셈과 뺄셈',
      '[2학기] 4. 사각형',
      '[2학기] 5. 꺾은선그래프',
      '[2학기] 6. 다각형'
    ],
    '5학년': [
      '[1학기] 1. 자연수의 혼합 계산',
      '[1학기] 2. 약수와 배수',
      '[1학기] 3. 규칙과 대응',
      '[1학기] 4. 약분과 통분',
      '[1학기] 5. 분수의 덧셈과 뺄셈',
      '[1학기] 6. 다각형의 둘레와 넓이',
      '[2학기] 1. 수의 범위와 어림하기',
      '[2학기] 2. 분수의 곱셈',
      '[2학기] 3. 합동과 대칭',
      '[2학기] 4. 소수의 곱셈',
      '[2학기] 5. 직육면체',
      '[2학기] 6. 평균과 가능성'
    ],
    '6학년': [
      '[1학기] 1. 분수의 나눗셈',
      '[1학기] 2. 각기둥과 각뿔',
      '[1학기] 3. 소수의 나눗셈',
      '[1학기] 4. 비와 비율',
      '[1학기] 5. 여러 가지 그래프',
      '[1학기] 6. 직육면체의 부피와 겉넓이',
      '[2학기] 1. 분수의 나눗셈 (심화)',
      '[2학기] 2. 소수의 나눗셈 (심화)',
      '[2학기] 3. 공간과 입체',
      '[2학기] 4. 비례식과 비례배분',
      '[2학기] 5. 원의 넓이',
      '[2학기] 6. 원기둥, 원뿔, 구'
    ]
  };

  // 학년 변경 시 단원 자동 동기화
  useEffect(() => {
    const options = chapterOptions[grade];
    if (options && options.length > 0) {
      if (!options.includes(chapter)) {
        setChapter(options[0]);
      }
    }
  }, [grade]);

  // 🌟 명시적 수정 모드(initialProblemId 존재)일 때만 기존 문제 데이터 로딩
  useEffect(() => {
    if (!initialProblemId) {
      // 신규 출제 모드일 때는 문제 ID를 비워두어 항상 새로운 고유 문제로 배포되도록 보장!
      setProblemId(null);
      setPreviewQuestions([]);
      setIsGenerated(false);
      return;
    }

    const fetchExistingProblem = async () => {
      try {
        setIsLoading(true);
        const existing = await getProblem(initialProblemId);
        if (existing) {
          setProblemId(existing.id);
          setSelectedDate(existing.date);
          setGrade(existing.grade);
          setChapter(existing.chapter);
          setProblemType(existing.type);
          setQuestionsCount(existing.questions.length);
          setPreviewQuestions(existing.questions);
          if (existing.targetClasses) {
            setTargetClasses(existing.targetClasses);
          }
          setIsGenerated(true);
        }
      } catch (err) {
        console.error('문제 로드 에러:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingProblem();
  }, [initialProblemId]);

  // Gemini API를 직접 호출하여 수학 문제 생성
  const handleGenerateProblems = async () => {
    if (!selectedDate) {
      alert('배포할 날짜를 선택해 주세요.');
      return;
    }
    if (targetClasses.length === 0) {
      alert('최소 1개 이상의 배포 대상 학급(반)을 선택해 주세요.');
      return;
    }

    const apiKey = localStorage.getItem('temp_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      alert('Gemini API 키가 설정되지 않았습니다. 관리자 대시보드 하단의 긴급 키 설정을 이용하시거나 .env 파일에 VITE_GEMINI_API_KEY를 입력해 주세요.');
      return;
    }

    setIsLoading(true);

    // 🎯 선택된 단원의 정밀 성취기준 및 출제 가이드라인 조회
    const standardInfo = CHAPTER_STANDARDS_MAP[grade]?.[chapter];
    const standardPromptBlock = standardInfo ? `
[📌 해당 단원 아이스크림 교과서 및 2022 개정 교육과정 성취기준 가이드]
- 핵심 학습 개념: ${standardInfo.coreConcepts}
- 출제 범위 및 수준 제한: ${standardInfo.scopeGuide}
` : '';

    // 🧮 문제 유형별 외형 포맷 제약 블록 생성 (단순계산문제 시 스토리텔링 완전 배제)
    let typeFormatGuide = '';
    if (problemType === '단순계산문제') {
      typeFormatGuide = `
[🚨 문제 유형: '단순계산문제 (연산 중심)' 엄격한 출제 규칙 - 100% 필수 준수!]
- 1번 문항부터 마지막 ${questionsCount}번 문항까지 **예외 없이 100% 순수 수식 연산 문제**로만 출제하세요.
- ❌ 절대 금지: 사람 이름(영희, 철수 등), 실생활 사물/상황(식혜, 사탕, 끈, 리본, 사과, 달리기, 빵 등), 문장형 스토리텔링은 단 한 단어도 포함하지 마세요!
- ✅ 필수 발문 포맷 예시:
  * "다음 계산을 하세요: 4/5 ÷ 3"
  * "5/6 ÷ 2/3의 몫을 기약분수로 구하세요."
  * "12.8 ÷ 4의 값을 소수로 구하세요."
  * "24와 36의 최대공약수를 구하세요."
- 마지막 문항이라고 해서 문장제나 실생활 문제로 변형하는 것을 엄격히 금지합니다.`;
    } else if (problemType === '문장제 서술형 문제') {
      typeFormatGuide = `
[🚨 문제 유형: '문장제 서술형 문제 (이해 중심)' 엄격한 출제 규칙 - 100% 필수 준수!]
- 1번 문항부터 마지막 ${questionsCount}번 문항까지 **수학적 개념과 관계식을 세워 해결하는 문장형 문제**로 출제하세요.
- ✅ 필수 발문 포맷 예시:
  * "어떤 수 □에 3을 곱해야 할 것을 잘못하여 더했더니 15가 되었습니다. 바르게 계산한 값을 구하세요."
  * "가로가 8cm, 세로가 5cm인 직사각형의 둘레는 몇 cm인지 구하세요."
  * "밑변이 12cm이고 높이가 7cm인 삼각형의 넓이를 구하세요."`;
    } else if (problemType === '실생활 응용 문제') {
      typeFormatGuide = `
[🚨 문제 유형: '실생활 응용 문제 (활용 중심)' 엄격한 출제 규칙 - 100% 필수 준수!]
- 1번 문항부터 마지막 ${questionsCount}번 문항까지 **실생활의 구체적인 상황(음식, 물건, 가격, 거리, 시간, 나누어 갖기 등)을 배경으로 한 응용 문제**로 출제하세요.
- ✅ 필수 발문 포맷 예시:
  * "식혜 4/5 L를 3명이 똑같이 나누어 마시려고 합니다. 한 사람이 마실 수 있는 식혜는 몇 L인지 기약분수로 구하세요."
  * "사탕 24개와 초콜릿 36개를 가능한 많은 학생에게 남김없이 똑같이 나누어 주려고 합니다. 몇 명에게 나누어 줄 수 있습니까?"`;
    }

    const prompt = `
당신은 대한민국 초등학교 수학 교육과정 및 아이스크림 교과서 집필 전문가입니다.
초등학교 ${grade} 수학 단원 [${chapter}]에 대한 [${problemType}] 아침활동 10분 수학 문제 ${questionsCount}문항을 생성해 주세요.
${typeFormatGuide}
${standardPromptBlock}
[필수 출제 원칙]
1. 위 [🚨 문제 유형 출제 규칙]을 1번부터 마지막 ${questionsCount}번 문제까지 **100% 동일한 형식으로 엄격히 일관되게 유지**하세요. (마지막 문항 변형 절대 금지!)
2. 단원 성취기준과 출제 범위 제한 지침을 준수하여, 아직 배우지 않은 상위 학년 개념이 절대 포함되지 않도록 하세요.
3. 초등학교 ${grade} 학생의 인지 발달 수준과 단원 특성에 꼭 맞는 난이도로 명확하게 출제하세요.
4. 학생들이 키보드로 손쉽게 입력할 수 있는 답안 형식을 고려하세요. (분수는 '3/2' 또는 '1 1/2' 형태 허용, 소수는 소수점 표기)
5. ⚠️ [중요: 입력 형식 안내(answerGuide)] 
   - answerGuide에는 **절대로 해당 문제의 실제 정답이나 정답 숫자를 예시로 넣지 마세요!**
   - 학생에게 정답이 노출되지 않도록, 오직 일반적인 입력 형태와 형식만 안내해야 합니다.
   - 예시 지침:
     * 자연수: "자연수로 입력하세요."
     * 분수: "기약분수로 입력하세요 (예: 1/2 형태)" 또는 "가분수 또는 대분수로 입력하세요 (예: 3/2 또는 1 1/2 형태)"
     * 소수: "소수로 입력하세요 (예: 0.5 형태)"
     * 단위: "단위를 제외하고 숫자만 입력하세요."
6. hint(힌트)에는 절대로 정답이나 직접적인 수식을 노출하지 말고, 학생이 스스로 생각할 수 있는 핵심 개념이나 풀이 방향에 대한 힌트만 적어주세요.
7. explanation(문제 풀이)에는 문제를 틀린 학생이 복습할 수 있도록 단계별 상세한 풀이 과정과 최종 정답 도출 식을 친절하게 기술해 주세요.
8. 반드시 아래 JSON 형식으로만 응답하고, 마크다운 코드블록(\`\`\`json)은 포함해도 되지만 추가적인 텍스트 설명은 붙이지 마세요.

JSON 응답 스키마:
[
  {
    "id": 1,
    "questionText": "문제 내용 지문 (예: 5/6 ÷ 2/3의 몫을 기약분수로 구하세요.)",
    "answers": ["5/4", "1 1/4"],
    "answerGuide": "기약분수 또는 대분수로 입력하세요 (예: 3/2 또는 1 1/2 형태)",
    "hint": "분수의 나눗셈은 나누는 분수의 분자와 분모를 바꾼 뒤 곱셈으로 바꾸어 계산할 수 있습니다.",
    "explanation": "5/6 ÷ 2/3 = 5/6 × 3/2 = (5×3)/(6×2) = 15/12 = 5/4 = 1 1/4입니다."
  }
]
`;

    try {
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          }),
        }
      );

      // 만약 모델 엔드포인트 404 등 실패 시 호환성을 위해 1.5-flash로 자동 폴백
      if (!response.ok) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            }),
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Gemini API 요청 실패: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      
      // 🌟 견고한 다단계 JSON 파싱 헬퍼 함수
      const parseSafeQuestionsJson = (text: string): Question[] => {
        let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 가장 바깥쪽 대괄호 [ ... ] 영역만 정밀 슬라이스
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          cleaned = cleaned.substring(start, end + 1);
        }

        // 1차 표준 파싱
        try {
          const res = JSON.parse(cleaned);
          if (Array.isArray(res)) return res;
        } catch (e1) {
          console.warn('1차 표준 JSON 파싱 실패, 자동 정제 복구 시도:', e1);
        }

        // 2차 정제 파싱: 후행 쉼표(trailing comma) 및 제어문자 정제
        try {
          const sanitized = cleaned
            .replace(/,\s*([\]}])/g, '$1') // 쉼표 뒤 닫는 괄호 제거
            .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, ''); // 불필요 제어문자 제거
          const res = JSON.parse(sanitized);
          if (Array.isArray(res)) return res;
        } catch (e2) {
          console.warn('2차 정제 JSON 파싱 실패, 개별 객체 정규식 추출 시도:', e2);
        }

        // 3차 복구: 개별 문제 객체 { ... } 단위 정규식 추출
        try {
          const objectMatches = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (objectMatches && objectMatches.length > 0) {
            const recovered: any[] = [];
            for (const objStr of objectMatches) {
              try {
                const cleanedObj = objStr.replace(/,\s*([\]}])/g, '$1');
                recovered.push(JSON.parse(cleanedObj));
              } catch (_) {}
            }
            if (recovered.length > 0) return recovered;
          }
        } catch (e3) {}

        throw new Error('생성된 문제의 형식이 올바르지 않습니다.');
      };

      let parsedQuestions: Question[] = [];
      try {
        parsedQuestions = parseSafeQuestionsJson(rawText);
      } catch (parseError) {
        console.error('JSON 파싱 실패 원본:', rawText);
        throw new Error('생성된 문제의 형식이 올바르지 않습니다. 다시 시도해 주세요.');
      }

      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error('문제가 정상적으로 생성되지 않았습니다.');
      }

      // 🌟 입력 형식 안내(answerGuide)에서 실제 정답 유출을 원천 방지하는 헬퍼 함수
      const sanitizeAnswerGuide = (guide: string, answers: string[]): string => {
        if (!guide) return '정답을 알맞은 형식으로 입력하세요.';
        let sanitized = guide;
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
              sanitized = sanitized.replace(regex, '...');
            }
          }
        }
        return sanitized;
      };

      // ID 재정렬 및 누락 필드 방어
      const formatted = parsedQuestions.map((q, idx) => {
        const answers = Array.isArray(q.answers) && q.answers.length > 0 ? q.answers.map(a => String(a).trim()) : ['0'];
        return {
          id: idx + 1,
          questionText: q.questionText || `문제 ${idx + 1}`,
          answers,
          answerGuide: sanitizeAnswerGuide(q.answerGuide || '정답을 입력하세요', answers),
          hint: q.hint || '문제를 차근차근 다시 읽어보세요.',
          explanation: q.explanation || '차근차근 계산하여 정답을 도출합니다.'
        };
      });

      setPreviewQuestions(formatted);
      setIsGenerated(true);
      setInspectIndex(0);
    } catch (err: any) {
      console.error(err);
      alert(`문제 생성 중 오류가 발생했습니다: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 문제 검수 중 내용 직접 수정 핸들러
  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const updated = [...previewQuestions];
    if (field === 'answers') {
      updated[index] = {
        ...updated[index],
        answers: typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    setPreviewQuestions(updated);
  };

  // 최종 저장 및 배포
  const handleSaveAndPublish = async () => {
    if (!selectedDate) {
      alert('배포할 날짜를 선택해 주세요.');
      return;
    }
    if (previewQuestions.length === 0) {
      alert('배포할 문제가 없습니다.');
      return;
    }
    if (targetClasses.length === 0) {
      alert('최소 1개 이상의 배포 대상 학급(반)을 선택해 주세요.');
      return;
    }

    try {
      setIsLoading(true);
      
      const finalProblemId = problemId || `${selectedDate}_${Date.now()}`;

      const problemData: Problem = {
        id: finalProblemId,
        date: selectedDate,
        grade,
        chapter,
        type: problemType,
        questions: previewQuestions,
        targetClasses
      };

      await saveProblem(problemData);
      alert(`[${selectedDate}] ${grade} ${chapter} (${targetClasses.join(', ')}) 문제가 성공적으로 배포되었습니다!`);
      onBack();
    } catch (err) {
      console.error('저장 에러:', err);
      alert('문제 저장 및 배포에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* 헤더 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>AI 아침활동 수학 문제 출제 및 검수</h2>
            <span className="badge badge-gray" style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', fontWeight: 600 }}>
              {initialProblemId ? '배포 문제 수정 모드' : '신규 문제 추가 모드'}
            </span>
          </div>
        </div>
        <button onClick={onBack} className="btn btn-secondary" style={{ flexShrink: 0 }}>
          ← 대시보드로 돌아가기
        </button>
      </div>

      <div className="grid grid-cols-2" style={{ gap: '2rem', alignItems: 'start' }}>
        {/* 왼쪽: 출제 조건 설정 (2열 컴팩트 슬림 카드) */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem' }}>출제 조건 설정</h3>

          {/* Row 1: [배포 날짜 (35%)] + [배포 대상 학급(반) (65%)] */}
          <div className="form-row-2col">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">배포 날짜</label>
              <input 
                type="date" 
                className="input-control" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">배포 대상 학급(반)</label>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.6rem', 
                padding: '0.6rem 0.75rem', 
                border: '1px solid var(--border-color)', 
                borderRadius: '10px', 
                backgroundColor: '#fafafa',
                minHeight: '44px',
                alignItems: 'center'
              }}>
                {classList.map((c) => {
                  const clsName = c.name;
                  const isChecked = targetClasses.includes(clsName);
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        value={clsName}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetClasses(prev => [...prev, clsName]);
                          } else {
                            setTargetClasses(prev => prev.filter(item => item !== clsName));
                          }
                        }}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                      {clsName}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: [대상 학년] + [수학 단원] */}
          <div className="form-row-2col">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">대상 학년</label>
              <select 
                className="input-control" 
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                <option value="3학년">3학년</option>
                <option value="4학년">4학년</option>
                <option value="5학년">5학년</option>
                <option value="6학년">6학년</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">수학 단원</label>
              <select 
                className="input-control" 
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              >
                {chapterOptions[grade]?.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: [문제 개수] + [문제 유형] */}
          <div className="form-row-2col" style={{ marginBottom: '1.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">문제 개수</label>
              <select 
                className="input-control" 
                value={questionsCount}
                onChange={(e) => setQuestionsCount(Number(e.target.value))}
              >
                <option value={5}>5문제</option>
                <option value={10}>10문제</option>
                <option value={15}>15문제</option>
                <option value={20}>20문제</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">문제 유형</label>
              <select 
                className="input-control" 
                value={problemType}
                onChange={(e) => setProblemType(e.target.value)}
              >
                <option value="단순계산문제">단순계산문제 (연산 중심)</option>
                <option value="문장제 서술형 문제">문장제 서술형 문제 (이해 중심)</option>
                <option value="실생활 응용 문제">실생활 응용 문제 (활용 중심)</option>
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerateProblems} 
            className="btn btn-primary btn-point"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={isLoading || !selectedDate}
          >
            {isLoading ? 'Gemini AI 문제 생성 중...' : 'AI 문제 생성하기'}
          </button>
        </div>

        {/* 오른쪽: 생성된 문제 목록 프리뷰 및 최종 검수 */}
        <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            생성 문제 검수 및 배포
            <InfoTooltip text="AI가 생성한 문제를 검토하고 내용을 필요에 맞게 즉시 수정할 수 있습니다." />
          </h3>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
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
                초등학교 교육 성취기준에 맞춰 수학 문제 세트를 구성 중입니다...
              </p>
            </div>
          ) : isGenerated && previewQuestions.length > 0 ? (
            <div>
              {/* 이전/다음 버튼을 동반한 슬라이더 조작 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button
                  onClick={() => setInspectIndex(prev => Math.max(0, prev - 1))}
                  disabled={inspectIndex === 0}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                >
                  ◀ 이전 문제
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  문제 {inspectIndex + 1} / {previewQuestions.length}
                </span>
                <button
                  onClick={() => setInspectIndex(prev => Math.min(previewQuestions.length - 1, prev + 1))}
                  disabled={inspectIndex === previewQuestions.length - 1}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                >
                  다음 문제 ▶
                </button>
              </div>

              {/* 현재 검수 중인 문제 편집 박스 */}
              {previewQuestions[inspectIndex] && (
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  marginBottom: '1.5rem'
                }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>문제 발문 (지문)</label>
                    <textarea
                      rows={3}
                      className="input-control"
                      value={previewQuestions[inspectIndex].questionText}
                      onChange={(e) => handleQuestionChange(inspectIndex, 'questionText', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>정답 허용 목록 (쉼표로 구분)</label>
                    <input
                      type="text"
                      className="input-control"
                      value={previewQuestions[inspectIndex].answers.join(', ')}
                      onChange={(e) => handleQuestionChange(inspectIndex, 'answers', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>입력 형식 안내</label>
                    <input
                      type="text"
                      className="input-control"
                      value={previewQuestions[inspectIndex].answerGuide}
                      onChange={(e) => handleQuestionChange(inspectIndex, 'answerGuide', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>풀이 힌트 (오답 시 1차 노출, 정답 미포함)</label>
                    <input
                      type="text"
                      className="input-control"
                      value={previewQuestions[inspectIndex].hint}
                      onChange={(e) => handleQuestionChange(inspectIndex, 'hint', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>문제 풀이 (오답 복습용 상세 풀이 과정)</label>
                    <textarea
                      rows={2}
                      className="input-control"
                      value={previewQuestions[inspectIndex].explanation || ''}
                      onChange={(e) => handleQuestionChange(inspectIndex, 'explanation', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveAndPublish}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontWeight: 700 }}
                disabled={isLoading}
              >
                검수 완료 및 학급 배포 확정
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              border: '2px dashed var(--border-color)',
              borderRadius: '12px'
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                왼쪽에서 조건을 설정하고 [AI 문제 생성하기]를 클릭하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};