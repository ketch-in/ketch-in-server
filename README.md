<h1 align="center">
    <a src="https://github.com/ketch-in" alt="ketch-in">
        <img src="https://avatars.githubusercontent.com/u/102146264" width=64 />
    </a>
    <br />
    KETCH IN SERVER
</h1>
<p align="center">
    <a href="./LICENSE">
        <img src="https://badgen.net/github/license/ketch-in/ketch-in-server" alt="LICENSE" />
    </a>
    <br />
    <a href="https://typescriptlang.org">
        <img src="https://badgen.net/badge/icon/typescript?icon=typescript&label" alt="using typescript" />
    </a>
    <a href="https://github.com">
        <img src="https://badgen.net/badge/icon/github?icon=github&label" alt="github" />
    </a>
    <a href="https://docker.com/">
        <img src="https://badgen.net/badge/icon/docker?icon=docker&label" alt="docker" />
    </a>
    <br />
    <a href="https://expressjs.com/">
        <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="using Express.js" />
    </a>
    <a href="https://eslint.org/">
        <img src="https://img.shields.io/badge/eslint-3A33D1?style=for-the-badge&logo=eslint&logoColor=white" alt="using eslint" />
    </a>
    <a href="https://nodejs.org/">
        <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="using node" />
    </a>
    <a href="http://vanilla-js.com/">
        <img src="https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E" alt="using javascript" />
    </a>
    <br />
    <a href="https://github.com/ketch-in/ketch-in-server/actions/workflows/deploy-fly.io.yml">
        <img src="https://github.com/ketch-in/ketch-in-server/actions/workflows/deploy-fly.io.yml/badge.svg" alt="Deploy Fly.io CI" />
    </a>
</p>

## 기능

- `WebRTC`를 위한 `Signaling 서버` 입니다.
- 이 서버는 [`Ketch-In`](https://github.com/ketch-in/ketch-in)와 호환됩니다.

## 로컬에서 사용하기

```bash
git clone https://github.com/ketch-in/ketch-in-server.git .

npm install

npm run start # npm run build
```

## 도커에서 사용하기

```bash
git clone https://github.com/ketch-in/ketch-in-server.git .

npm run docker:start # npm run docker:build

npm run docker:stop # <-- 도커 중단하기
```
