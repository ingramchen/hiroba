# hiroba

本專案是 kekeke.cc 的複刻版：照著原站的功能盡可能地複製。
前端是 Vue，伺服器可以跑在 Node 或 Cloudflare Workers 上， 媒體放在任何 S3 相容的儲存。
本專案與原站無關，未獲其授權或背書；「kekeke」是原站的名稱與商標，見 `NOTICE`。

Demo：https://kekeke.ing-studio.work （資料會不定期清空）

## Run locally

Docker with Compose is all you need for this path. Without Docker: Node 24 and pnpm (`corepack enable`).

```
cp .env.example .env
docker compose up
```

打開 http://localhost:3000 。MinIO 主控台在 http://localhost:9001（帳號 `hirobaminio`，密碼 `hirobaminio`）。

不用 Docker 的話，Node 伺服器只讀環境變數（`.env` 是給 `docker compose` 用的，node 不會讀它），
而且要有一個 S3 相容的儲存，否則圖片、影片與媒體載入都是關閉的。最快的做法是只把 compose 檔裡的
MinIO 拉起來（compose 讀 `.env`，沒有它連 MinIO 都起不來）：

```
cp .env.example .env
docker compose up -d minio minio-init
pnpm install
pnpm build
export TOKEN_SECRET=change-me
export WEB_LOADER_KEY=change-me-too
export WEB_DIST=../web/dist
export S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY=hirobaminio S3_SECRET_KEY=hirobaminio
cd server && node dist/adapters/node/main.js
```

`WEB_DIST=../web/dist` 指到打包好的前端；`S3_*` 換成任何 S3 相容服務的端點與金鑰都可以。
其他環境變數見 `DEVELOPMENT.md`。

設定、登入、正式部署、Cloudflare 與授權細節都在 `DEVELOPMENT.md`（英文）。

## 授權

程式碼採 MIT License，見 `LICENSE`。第三方素材各依其原授權，見 `NOTICE`。
