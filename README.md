# Skyline Vanguard

Three.js와 TypeScript로 만든 프론트엔드 전용 3D 횡스크롤 비행기 슈팅 게임입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 표시된 로컬 주소를 열고 방향키로 이동, 스페이스 바로 발사합니다.

휴대폰에서는 화면 아래의 방향 패드와 `FIRE` 버튼을 사용합니다.

## 검증

```bash
npm run build
```

## 배포

GitHub 저장소의 `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 `dist/`를 GitHub Pages에 배포합니다.
저장소 설정에서 Pages의 배포 소스를 `GitHub Actions`로 한 번 지정해야 합니다.
