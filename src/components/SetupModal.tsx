import React, { useState } from 'react';
import { parseFirebaseConfigText, RECOMMENDED_FIRESTORE_RULES } from '../utils/configParser';
import { saveAppConfig, CustomFirebaseConfig } from '../config/appConfig';
import { testGeminiApiKey, testFirebaseConnection, initFirebaseWithConfig } from '../services/dynamicFirebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

interface SetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onComplete }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Gemini API 상태
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Step 2: Firebase 설정 상태
  const [rawFirebaseText, setRawFirebaseText] = useState('');
  const [parsedFirebaseConfig, setParsedFirebaseConfig] = useState<CustomFirebaseConfig | null>(null);
  const [firebaseTesting, setFirebaseTesting] = useState(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);

  // Step 3: 관리자 계정 생성 상태
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountError, setAccountError] = useState('');

  if (!isOpen) return null;

  // 1단계 통과 조건: 키가 입력되고 연결 테스트가 성공했을 때
  const isStep1Completed = !!geminiKey.trim() && geminiTestResult?.success === true;

  // 2단계 통과 조건: Firebase 설정이 파싱되고 DB 연결 테스트가 성공했을 때
  const isStep2Completed = !!parsedFirebaseConfig && firebaseTestResult?.success === true;

  // 3단계 통과 조건: 이메일 형식 및 비밀번호 6자 이상 일치
  const isStep3Valid = adminEmail.includes('@') && adminPassword.length >= 6 && adminPassword === confirmPassword;

  // Firebase 텍스트 붙여넣기 시 실시간 자동 파싱
  const handleFirebaseTextChange = (text: string) => {
    setRawFirebaseText(text);
    const parsed = parseFirebaseConfigText(text);
    setParsedFirebaseConfig(parsed);
    setFirebaseTestResult(null);
  };

  // Gemini 연결 테스트 실행
  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestResult({ success: false, message: 'Gemini API 키를 먼저 입력해 주세요.' });
      return;
    }
    setGeminiTesting(true);
    setGeminiTestResult(null);
    const res = await testGeminiApiKey(geminiKey.trim());
    setGeminiTesting(false);
    setGeminiTestResult(res);
  };

  // Firebase 연결 테스트 실행
  const handleTestFirebase = async () => {
    if (!parsedFirebaseConfig) {
      setFirebaseTestResult({ success: false, message: '유효한 Firebase 설정 코드를 붙여넣어 주세요.' });
      return;
    }
    setFirebaseTesting(true);
    setFirebaseTestResult(null);
    const res = await testFirebaseConnection(parsedFirebaseConfig);
    setFirebaseTesting(false);
    setFirebaseTestResult(res);
  };

  // 보안 규칙 복사
  const handleCopyRules = () => {
    navigator.clipboard.writeText(RECOMMENDED_FIRESTORE_RULES);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  // 최종 완료 및 관리자 계정 생성
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError('');

    if (!isStep1Completed) {
      setAccountError('Step 1에서 Gemini API 키 연결 테스트를 먼저 완료해 주세요.');
      setCurrentStep(1);
      return;
    }

    if (!isStep2Completed) {
      setAccountError('Step 2에서 Firebase DB 연결 테스트를 먼저 완료해 주세요.');
      setCurrentStep(2);
      return;
    }

    if (!adminEmail.includes('@')) {
      setAccountError('올바른 이메일 형식을 입력해 주세요.');
      return;
    }

    if (adminPassword.length < 6) {
      setAccountError('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    if (adminPassword !== confirmPassword) {
      setAccountError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. 동적 Firebase 초기화
      const { auth } = initFirebaseWithConfig(parsedFirebaseConfig);

      // 2. Firebase Auth에 관리자 계정 생성 시도
      try {
        await createUserWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      } catch (authErr: any) {
        // 이미 생성된 계정이면 로그인 시도
        if (authErr.code === 'auth/email-already-in-use') {
          await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
        } else {
          throw authErr;
        }
      }

      // 3. 앱 설정 로컬 스토리지에 저장
      saveAppConfig(geminiKey, parsedFirebaseConfig, adminEmail);

      setIsSubmitting(false);
      onComplete();
    } catch (err: any) {
      console.error('설정 완료 중 오류:', err);
      setIsSubmitting(false);
      if (err.code === 'auth/invalid-email') {
        setAccountError('유효하지 않은 이메일 주소입니다.');
      } else if (err.code === 'auth/wrong-password') {
        setAccountError('기존 계정의 비밀번호와 일치하지 않습니다.');
      } else {
        setAccountError(`계정 생성 오류: ${err.message || '다시 시도해 주세요.'}`);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        maxWidth: '740px',
        width: '100%',
        height: '540px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}>
        {/* 모달 상단 헤더 */}
        <div style={{
          padding: '16px 24px 12px',
          borderBottom: '1px solid #F1F5F9',
          backgroundColor: '#FAFAFA',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 2px 0' }}>
            초등 수학 AI 코스웨어 설정
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}>
            우리 반 전용 AI 키와 데이터베이스를 연동하여 맞춤형 수학 교실을 시작하세요.
          </p>
        </div>

        {/* 모달 본문 영역 */}
        <div style={{ padding: '16px 24px 20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 미니멀 언더라인 스텝 인디케이터 (토스/애플 스타일) */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '8px',
            position: 'relative',
            flexShrink: 0,
          }}>
            {[
              { step: 1, num: '01', label: 'Gemini API', enabled: true, isDone: isStep1Completed },
              { step: 2, num: '02', label: 'Firebase DB', enabled: isStep1Completed, isDone: isStep2Completed },
              { step: 3, num: '03', label: '관리자 계정', enabled: isStep1Completed && isStep2Completed, isDone: false },
            ].map((item) => {
              const isCurrent = currentStep === item.step;
              const isPassed = item.isDone;
              return (
                <button
                  key={item.step}
                  type="button"
                  disabled={!item.enabled}
                  onClick={() => item.enabled && setCurrentStep(item.step as 1 | 2 | 3)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: item.enabled ? 'pointer' : 'not-allowed',
                    opacity: item.enabled ? 1 : 0.4,
                    padding: '0 0 6px 0',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: isCurrent ? 'var(--color-point, #064e3b)' : isPassed ? 'var(--color-point, #064e3b)' : '#94A3B8',
                      fontFamily: 'monospace',
                    }}>
                      {item.num}
                    </span>
                    <span style={{
                      fontSize: '0.84rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? '#0F172A' : isPassed ? '#334155' : '#94A3B8',
                    }}>
                      {item.label}
                    </span>
                  </div>
                  {/* 슬림 밑줄 바 */}
                  <div style={{
                    width: '100%',
                    height: isCurrent ? '2.5px' : '2px',
                    borderRadius: '2px',
                    backgroundColor: isCurrent
                      ? 'var(--color-point, #064e3b)'
                      : isPassed
                        ? 'rgba(6, 78, 59, 0.45)'
                        : '#E2E8F0',
                    transition: 'all 0.25s ease',
                  }} />
                </button>
              );
            })}
          </div>

          {/* Step 1: Gemini API Key */}
          {currentStep === 1 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 상세 발급 안내 박스 */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.82rem',
                  color: '#334155',
                  lineHeight: '1.45',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    marginBottom: '8px',
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-point, #064e3b)',
                      display: 'inline-block',
                    }} />
                    Gemini API 키 무료 발급 방법
                  </div>
                  <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <li>
                      <strong>사이트 접속:</strong> <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--color-point, #064e3b)', fontWeight: 700, textDecoration: 'underline' }}>Google AI Studio (새 창 열기)</a> 접속 → 구글 계정으로 로그인
                    </li>
                    <li>
                      <strong>키 만들기 클릭:</strong> 화면 왼쪽 상단의 <strong>[API 키 만들기]</strong> 파란색 버튼 클릭
                    </li>
                    <li>
                      <strong>프로젝트 선택:</strong> '새 키 만들기' 창에서 '키 이름' 입력 → '가져온 프로젝트 선택' 드롭다운에서 <strong>[+ 프로젝트 만들기]</strong> 선택 → <strong>[키 만들기]</strong> 클릭
                    </li>
                    <li>
                      <strong>키 복사 및 테스트:</strong> 발급된 키(예: <code>AQ...</code>) 복사 → 아래 입력창에 붙여넣고 <strong>[연결 테스트]</strong> 클릭
                    </li>
                  </ol>
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }}>
                    * Gemini API의 기본 무료 제공량만으로도 본 웹앱의 AI 문제 출제 및 리포트 생성을 충분히 이용하실 수 있습니다.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                    Gemini API Key
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => {
                        setGeminiKey(e.target.value);
                        setGeminiTestResult(null);
                      }}
                      placeholder="AQ... 또는 발급받은 Gemini 키 붙여넣기"
                      style={{
                        width: '100%',
                        padding: '8px 40px 8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: '#64748B',
                      }}
                    >
                      {showGeminiKey ? '숨김' : '보기'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiTesting || !geminiKey.trim()}
                  style={{
                    backgroundColor: geminiTestResult?.success
                      ? 'var(--color-point, #064e3b)'
                      : geminiTestResult?.success === false
                        ? '#DC2626'
                        : '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 0',
                    width: '130px',
                    minWidth: '130px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: geminiTesting || !geminiKey.trim() ? 'not-allowed' : 'pointer',
                    opacity: geminiTesting || !geminiKey.trim() ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {geminiTestResult?.success
                    ? '✓ 연결 성공'
                    : geminiTestResult?.success === false
                      ? '✕ 다시 시도'
                      : '연결 테스트'}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!isStep1Completed}
                  style={{
                    backgroundColor: isStep1Completed ? 'var(--color-point, #064e3b)' : '#CBD5E1',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 0',
                    width: '76px',
                    minWidth: '76px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isStep1Completed ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Firebase Config */}
          {currentStep === 2 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 상세 생성 및 설정 안내 박스 */}
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#334155',
                lineHeight: '1.45',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  marginBottom: '8px',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-point, #064e3b)',
                    display: 'inline-block',
                  }} />
                  Firebase 프로젝트 및 DB 생성 방법
                </div>
                <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <li>
                    <strong>프로젝트 만들기:</strong> <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--color-point, #064e3b)', fontWeight: 700, textDecoration: 'underline' }}>Firebase 콘솔 (새 창 열기)</a> 로그인 → <strong>[프로젝트 만들기]</strong> 클릭 후 이름 입력 (애널리틱스는 해제 권장)
                  </li>
                  <li>
                    <strong>웹 앱 등록:</strong> 프로젝트 개요 상단 <strong>[+ 앱 추가]</strong> 클릭 → <strong>[웹(&lt;/&gt;)]</strong> 아이콘 선택 → 앱 닉네임 입력 후 <strong>[앱 등록]</strong> (Hosting 체크는 건너뜁니다)
                  </li>
                  <li>
                    <strong>SDK 코드 복사:</strong> <strong>[npm 사용]</strong> 선택 → 화면의 <strong>SDK</strong> 코드 뭉치를 통째로 복사하여 아래에 붙여넣기
                  </li>
                  <li>
                    <strong>Firestore DB 생성:</strong> 좌측 <strong>[데이터베이스 및 스토리지]</strong> → <strong>[Firestore]</strong> → <strong>[데이터베이스 만들기]</strong> (위치: Seoul, 프로덕션 모드로 생성)
                  </li>
                  <li>
                    <strong>보안 규칙 설정:</strong> Firestore 상단 <strong>[규칙]</strong> 탭에서 <code>if false;</code>를 <code>if true;</code>로 수정 후 <strong>[게시]</strong> 클릭 (아래 '추천 보안규칙 복사' 버튼 활용)
                  </li>
                  <li>
                    <strong>로그인 활성화:</strong> 좌측 <strong>[보안]</strong> → <strong>[Authentication]</strong> → <strong>[시작하기]</strong> → <strong>[이메일/비밀번호]</strong>를 '사용 설정'으로 켜고 <strong>[저장]</strong>
                  </li>
                </ol>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }}>
                  * Firebase Spark(무료 요금제)의 기본 제공량만으로도 우리 학급의 코스웨어를 원활하게 운영하기에 충분합니다.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                  Firebase SDK 코드 뭉치 붙여넣기
                </label>
                <textarea
                  rows={3}
                  value={rawFirebaseText}
                  onChange={(e) => handleFirebaseTextChange(e.target.value)}
                  placeholder={`// Import the functions you need from the SDKs you need\nimport { initializeApp } from "firebase/app";\n\n// Your web app's Firebase configuration\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-school.firebaseapp.com",\n  projectId: "my-school",\n  storageBucket: "my-school.firebasestorage.app",\n  messagingSenderId: "123456789",\n  appId: "1:123456:web:abcd"\n};\n\n// Initialize Firebase\nconst app = initializeApp(firebaseConfig);`}
                  style={{
                    width: '100%',
                    height: '76px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                    lineHeight: '1.35',
                    resize: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                이전 단계
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={firebaseTesting || !parsedFirebaseConfig}
                  style={{
                    backgroundColor: firebaseTestResult?.success
                      ? 'var(--color-point, #064e3b)'
                      : firebaseTestResult?.success === false
                        ? '#DC2626'
                        : '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 0',
                    width: '130px',
                    minWidth: '130px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: firebaseTesting || !parsedFirebaseConfig ? 'not-allowed' : 'pointer',
                    opacity: firebaseTesting || !parsedFirebaseConfig ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {firebaseTestResult?.success
                    ? '✓ DB 연결 성공'
                    : firebaseTestResult?.success === false
                      ? '✕ 다시 시도'
                      : 'DB 연결 테스트'}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!isStep2Completed}
                  style={{
                    backgroundColor: isStep2Completed ? 'var(--color-point, #064e3b)' : '#CBD5E1',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 0',
                    width: '76px',
                    minWidth: '76px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isStep2Completed ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 관리자 계정 생성 */}
        {currentStep === 3 && (
          <form onSubmit={handleCompleteSetup} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 상세 계정 생성 안내 박스 */}
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#334155',
                lineHeight: '1.45',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  marginBottom: '8px',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-point, #064e3b)',
                    display: 'inline-block',
                  }} />
                  교사용 관리자 계정 등록 안내
                </div>
                <div>
                  선생님께서 교사 대시보드에 로그인할 때 사용할 이메일과 비밀번호를 입력해 주세요. 방금 연동하신 선생님의 개인 Firebase Authentication에 관리자 계정이 자동으로 등록되고 즉시 로그인됩니다.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                  선생님 이메일 (아이디)
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="teacher@school.kr"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                    비밀번호 (6자리 이상)
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {accountError && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                }}>
                  {accountError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  이전 단계
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isStep3Valid}
                  style={{
                    backgroundColor: isStep3Valid ? 'var(--color-point, #064e3b)' : '#CBD5E1',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: isStep3Valid ? 'pointer' : 'not-allowed',
                    opacity: isSubmitting ? 0.7 : 1,
                    boxShadow: isStep3Valid ? 'var(--shadow-button)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSubmitting ? '설정 저장 및 계정 생성 중...' : '우리 반 코스웨어 시작하기'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
