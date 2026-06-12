# 이미지 메이커

소설 · AI 채팅 로그 이미지 생성기

## 배포 방법

### 1. GitHub 저장소 생성
GitHub에서 새 저장소 생성 (예: `chat-image-maker`)

### 2. vite.config.js 수정
```js
base: '/저장소이름/',   // ← 본인 저장소 이름으로 변경
```

### 3. 저장소에 푸시
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/유저명/저장소이름.git
git push -u origin main
```

### 4. GitHub Pages 활성화
저장소 → Settings → Pages → Source: **GitHub Actions** 선택

→ `main` 브랜치에 푸시할 때마다 자동 배포됩니다.

## 캐릭터 추가

`src/ChatImageMaker.jsx` 상단 `CHARACTERS` 배열 수정:

```js
{
  id: 'char1',
  name: '캐릭터 이름',
  emoji: '🌸',
  bgImg: 'image/배경파일.jpg',  // public/image/ 폴더에 이미지 저장
}
```

배경 이미지는 `public/image/` 폴더에 넣으면 됩니다.

## 로컬 개발

```bash
npm install
npm run dev
```
