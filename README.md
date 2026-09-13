# hiroba

本專案是 kekeke.cc 的複刻版：照著原站的功能盡可能地複製。
前端是 Vue，伺服器可以跑在 Node 或 Cloudflare Workers 上， 媒體放在任何 S3 相容的儲存。
本專案與原站無關，未獲其授權或背書；「kekeke」是原站的名稱與商標，見 `NOTICE`。

Demo：https://kekeke.ing-studio.work （資料會不定期清空）

## Run locally

```
cp .env.example .env
docker compose up
```

打開 http://localhost:3000 。MinIO 主控台在 http://localhost:9001（帳號 `hirobaminio`，密碼 `hirobaminio`）。

不用 Docker 的話：

```
pnpm install
pnpm build
cd server && node dist/adapters/node/main.js
```

環境變數見 `DEVELOPMENT.md`（`WEB_DIST=../web/dist` 指到打包好的前端）。

設定、登入、正式部署、Cloudflare 與授權細節都在 `DEVELOPMENT.md`（英文）。

## 授權

程式碼採 MIT License，見 `LICENSE`。第三方素材各依其原授權，見 `NOTICE`。
