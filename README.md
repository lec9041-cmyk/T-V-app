# TOEIC Master - 토익 단어 암기 앱

세련되고 모던한 디자인의 토익 단어 학습 웹 앱입니다.

## 🌟 주요 기능

- ✅ **플래시카드 학습**: 세련된 glassmorphism 디자인
- ✅ **4지선다 퀴즈**: 실시간 정답 피드백
- ✅ **XP & 레벨 시스템**: 학습하며 성장하는 단어 나무
- ✅ **학습 통계**: 달력 히트맵으로 학습 기록 확인
- ✅ **완벽한 반응형**: 모바일/태블릿/데스크톱 최적화
- ✅ **음성 발음**: TTS를 통한 영단어 발음

## 🚀 Vercel 배포 방법

### 1단계: GitHub에 코드 푸시

현재 작업 디렉토리의 코드를 GitHub 레포지토리에 푸시합니다:

```bash
# 로컬에서 작업하는 경우
git init
git add .
git commit -m "Initial commit: TOEIC Master app"
git branch -M main
git remote add origin https://github.com/lec9041-cmyk/TOEIC-VOCA.git
git push -u origin main
```

### 2단계: Vercel 배포

1. **Vercel 계정 생성/로그인**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **새 프로젝트 생성**
   - "Add New..." → "Project" 클릭
   - GitHub 레포지토리 `TOEIC-VOCA` 선택

3. **빌드 설정 (자동 감지됨)**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install` (자동)

4. **배포**
   - "Deploy" 버튼 클릭
   - 약 1-2분 후 배포 완료!

### 3단계: 배포 완료! 🎉

배포가 완료되면 다음과 같은 URL을 받게 됩니다:
- `https://toeic-voca.vercel.app` (또는 프로젝트명에 따라 다름)

## 📲 홈 화면에 추가 (PWA)

모바일에서 앱처럼 사용하려면:

### iOS (Safari)
1. Safari에서 배포된 URL 접속
2. 하단 공유 버튼 탭
3. "홈 화면에 추가" 선택
4. "추가" 버튼 탭

### Android (Chrome)
1. Chrome에서 배포된 URL 접속
2. 우측 상단 메뉴 (⋮) 탭
3. "홈 화면에 추가" 선택
4. "설치" 또는 "추가" 버튼 탭

설치 후 홈 화면에서 TOEIC Master 아이콘을 탭하면 전체 화면 앱으로 실행됩니다! 🎯

## 📱 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (Figma Make에서는 자동 실행됨)
npm run dev

# 빌드
npm run build
```

## 🛠️ 실행 문제 해결 (Troubleshooting)

### 1) `npm warn Unknown env config "http-proxy"`

- 이 메시지는 **경고(warn)** 이며, 현재 빌드/실행을 막는 치명적 오류는 아닙니다.
- npm 설정에 오래된 `http-proxy` 키가 남아 있을 때 발생할 수 있습니다.

정리 명령어:

```bash
npm config delete http-proxy
npm config delete https-proxy
```

### 2) 개발 서버가 안 열리는 경우

프로젝트는 Vite 기반이라 보통 아래 명령으로 실행됩니다.

```bash
npm run dev
```

외부 네트워크(같은 와이파이 기기)에서 접속하려면:

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

### 3) Node 버전 확인

Vite 6 환경에서는 Node 버전이 너무 낮으면 실행이 실패할 수 있습니다. 먼저 버전을 확인하세요.

```bash
node -v
```

## 🔄 자동 배포

GitHub에 코드를 푸시하면 Vercel이 자동으로 새 버전을 배포합니다:

```bash
git add .
git commit -m "Update features"
git push
```

## 📂 단어 데이터

현재 앱에는 **DAY 1-9**, 총 **1,500개 이상**의 토익 필수 단어가 포함되어 있습니다.

CSV 파일 위치: `public/toeic_words.csv`

CSV 형식:
```csv
day,no,word,meaning
DAY1,1,resume,이력서
DAY1,2,opening,"공석,결원;개장,개시"
```

### 데이터 업데이트

추가 단어를 넣으려면:
1. `public/toeic_words.csv` 파일 수정
2. `DaySelector.tsx`에서 `totalDays` 값 조정
3. GitHub에 푸시하면 자동 배포

## 🎨 기술 스택

- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Tailwind CSS v4** - 스타일링
- **Vite** - 빌드 도구
- **shadcn/ui** - UI 컴포넌트
- **localStorage** - 데이터 저장

## 📝 라이선스

MIT License

---

Made with ❤️ by Claude
