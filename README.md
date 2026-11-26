# 留白日程 · Blanktime

網站：https://barry3687.github.io/blanktime/

## 開發版現況（尚未合併正式網站）

2026-11-26：開發分支 codex/cloud-calendar-checkpoint-20261126 已加入實際行事曆、課表和一週規則排程，並接上 Supabase 客戶端。正式 main 仍是先前版本；Google OAuth 與真實雙裝置驗收完成前不合併部署。

- 滿版深綠介面，移除外圍置中卡片與大面積空白。
- 整合原版番茄鐘，完整保留背景、城市、日夜天氣、聲音、動畫、設定及今日／近七天／歷史次數。頂列和原版共用單一計時狀態，切換頁面與重整持續計時。
- 沿用原版 window-seat-pomodoro-v1 儲存鍵；原站與本站同屬 barry3687.github.io，可讀取同一瀏覽器原有的番茄鐘統計。
- 整合循序漸進的逐觀念教學、公式與教材圖解、四選一判分、提示重試、解析與理解確認、接續學習。移除原站品牌頁首及獨立立體座標探索工具。
- 教材包檔案或貼上 JSON → 驗證 → 預覽 → 確認匯入。支援多門課，同版內容衝突及降版會停止，相同內容重試不重複，升版保留進度。
- 讀書計畫連結實際章節理解進度與手動 A／B／C／F 熟悉度；答對一題不自動升等。
- 教材與進度備份／合併還原，原始 TXT／MD／圖片／PDF 本地預覽。DOCX 可選檔，此靜態版不解析其文字。

主版面以課程與接續學習為主，匯入和原始教材預覽在右。兩個原站的程式碼複製進 modules/，不是跳轉原站。番茄鐘背景始終保留原版。原先約 6.7 MB 的單檔已拆為 8.5 KB 入口、獨立程式、樣式與 18 個原始素材，素材未重新壓縮；背景載入不阻擋計時器。

## 尚未完成

Supabase 專案已建立，schema 已成功執行，回傳網址已設定。Google provider 已啟用，Web OAuth client 已由使用者設定；仍待真實登入與同步驗收，尚不能宣稱跨裝置同步已完成。開發版已接上每帳號快取、同步佇列、版本衝突處理及共享倒數，仍需真實登入與雙裝置驗收。

開發版今天與行事曆讀取使用者實際輸入，支援事項編輯、固定課表、停課日期與課表 JSON 核對匯入。讀書計畫可預覽一週規則排程，確認後加入；保留 30 分鐘以上休息與獨立彈性時間。這是確定性規則排程，沒有即時模型 API。國定假日自動資料與系統通知尚未完成，假日可人工加入。

原版選擇題與數值題可在前端判分。即時 AI 推導／圖片批改未部署後端，介面會說明未連接。舊學習模組 backend/ 僅保留原始程式參考，沒有啟用，GitHub Pages 不執行 Python。

## 教材與資料

使用 ChatGPT／Gemini 整理教材，不需要網站模型 API。參考 skills/blanktime-study-coach/SKILL.md 與 examples/minimal-package.json，生成教材包後匯入。自編範例不會預先加入正式課程。

目前正式版與未登入的訪客資料存在目前瀏覽器；Google 尚未啟用，換裝置仍須使用備份。清除網站資料會清除個人內容。原始教材預覽只保留在頁面記憶體，重新整理會清除。公開 Repository 不含私人教材或金鑰。建議一次在一個頁面編輯教材。

## 驗證

在本目錄執行 python -m http.server 8765，再開啟 http://127.0.0.1:8765/ 。

- node scripts/check.cjs
- node scripts/integration.test.cjs
- node scripts/cloud.test.cjs
- node scripts/cloud-app.test.cjs
- node scripts/storage.test.cjs
- node scripts/planner.test.cjs
- node scripts/cloud-sql.test.cjs（需另安裝 @electric-sql/pglite，或傳入套件的 dist/index.cjs 路徑）
- node modules/learning/tests/core.test.js
- node modules/learning/tests/figures.test.js

由 main 根目錄發布 GitHub Pages。

原番茄鐘：https://github.com/Barry3687/Pomodoro_Technique_Vibe_Coding
原逐觀念學習：https://github.com/Barry3687/stepwise-learning

同步整合測試使用真實前端協調程式、儲存層與 Repository，但 Auth／RPC 為模擬服務。涵蓋重設的多鍵事件、重設期間新增進度、另一裝置重設衝突、首次連線失敗後保留變更及帳號切換舊回覆隔離。這不替代真實 Google／雙裝置驗收。

2026-11-26 最新確認：行事曆月／週及日期詳情只列重要事項（含獨立的報告類別），每日安排仍保留課表與休息。過時未完成事項保留原時段並標示，重新排程不移除已過時段。截止日期會另外出現在重要行事曆。Google Cloud 專案已建立，尚在設定 Google Auth 品牌，仍未建立 Web OAuth 用戶端。

真實登入本機驗收入口：python scripts/preview-auth.py。測試前需確認 Supabase 暫時允許 http://127.0.0.1:8765/ 作為回傳網址，測試完成移除；原正式 config.json 維持 GitHub Pages 網址。此伺服器不輸出登入回傳的 query 參數，不含 secret key。
