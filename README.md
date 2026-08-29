# 🏫 초등 맞춤형 AI 수학 코스웨어 (아침활동 10분)

> **전국 초등 선생님들을 위한 100% 무료, 오픈소스 AI 맞춤형 수학 학습 플랫폼**  
> 2022/2015 개정 교육과정 및 아이스크림 교과서 성취기준 완벽 연동 🎯

<br />

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/EduKraft-git/AI_Courseware)

<br />

---

## ✨ 주요 특징

1. **지속 가능한 무료 공유 모델 (BYOK & BYOD)**
   * **선생님 개인 도메인 무료 생성:** Vercel 배포 버튼 클릭 한 번으로 나만의 독립 웹사이트(`https://my-class.vercel.app`)가 생성됩니다.
   * **학생 개인정보 완벽 보호:** 학생들의 성취도, 오답, 출결 데이터가 선생님의 개인 Firebase 데이터베이스에만 안전하게 저장됩니다.
   * **비용 0원:** Google Gemini AI 무료 티어 및 Firebase 무료 티어로 학급 운영 비용이 전혀 들지 않습니다.

2. **초등학생을 위한 쉬운 학습 환경**
   * **초간편 로그인:** 비밀번호 없이 `[학급 선택 ➡️ 번호 ➡️ 이름]`으로 3초 만에 접속.
   * **스마트 힌트 & 단계별 풀이:** 오답 시 개념 힌트 제공, 3회 이상 오답 또는 정답 시 상세 해설 자동 공개.
   * **문항별 풀이 시간 정밀 측정:** 학생의 연산 속도와 문제 풀이 소요 시간을 초 단위로 분석.

3. **교사용 올인원 스마트 관리 대시보드**
   * **AI 문제 자동 출제기:** 3~6학년 전 학기 단원별 성취기준에 맞춰 3가지 유형(단순계산 / 문장제 / 실생활 응용) 10문항 자동 출제.
   * **실시간 온라인 모니터링:** 학생들의 실시간 접속 상태 및 문제 풀이 현황 하트비트 감지.
   * **출결 & 학습 면제권:** 출석, 질병결석, 출석인정결석, 학습 면제권 4단 관리.
   * **월간 진도표 (Monthly Grid):** 학급 전체 학생들의 일자별 과제 완료 현황 한눈에 파악.
   * **AI 학생 분석 리포트:** 학생별 취약점 진단 및 학부모 상담용 종합 지도 리포트 자동 생성.

---

## 🚀 3분 만에 시작하기 (교사용 가이드)

### 1단계: Vercel에 무료 배포하기
아래 버튼을 클릭하여 선생님의 깃허브 계정에 무료 웹사이트를 생성합니다:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/EduKraft-git/AI_Courseware)
2. Vercel 및 GitHub 계정으로 로그인 후 **[Deploy]**를 누르면 1분 뒤 선생님만의 웹사이트 주소가 만들어집니다.

### 2단계: 웹 화면에서 3단계 빠른 설정 (3분)
배포된 선생님의 웹사이트에 접속하면 **설정 마법사**가 자동으로 실행됩니다.
* **Step 1: Gemini AI 키 입력**  
  [Google AI Studio](https://aistudio.google.com/app/apikey)에서 `Create API key` 버튼을 눌러 무료 키를 발급받아 붙여넣습니다.
* **Step 2: Firebase 설정 붙여넣기**  
  [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트 생성 후 웹 앱을 추가하고, 화면에 나오는 `const firebaseConfig = { ... };` 코드를 통째로 복사해서 붙여넣습니다.
* **Step 3: 관리자 계정 생성**  
  선생님께서 로그인할 이메일과 비밀번호를 입력하고 `[시작하기]`를 누르면 끝!

---

## 🛠️ 기술 스택
* **Frontend:** React 19, TypeScript, Vite
* **Backend:** Firebase (Firestore Database, Authentication)
* **AI Model:** Google Gemini API (`@google/generative-ai`)
* **Deployment:** Vercel (SPA Optimization)

---

## 📄 라이선스
This project is open-source and free for all educators.
