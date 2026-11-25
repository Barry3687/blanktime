# 留白日程 · Blanktime

網站：https://barry3687.github.io/blanktime/

## 本輪已完成

2026-11-26：上方導覽與番茄鐘合併成單一精簡列，釋出原版番茄鐘的可用畫面。學習頁整理成白話理解、公式應用、驗證題，較長推導及選用批改預設收合。

- 滿版深綠介面，移除外圍置中卡片與大面積空白。
- 整合原版番茄鐘，完整保留背景、城市、日夜天氣、聲音、動畫、設定及今日／近七天／歷史次數。頂列和原版共用單一計時狀態，切換頁面與重整持續計時。
- 沿用原版 window-seat-pomodoro-v1 儲存鍵；原站與本站同屬 barry3687.github.io，可讀取同一瀏覽器原有的番茄鐘統計。
- 整合循序漸進的逐觀念教學、公式與教材圖解、四選一判分、提示重試、解析與理解確認、接續學習。移除原站品牌頁首及獨立立體座標探索工具。
- 教材包檔案或貼上 JSON → 驗證 → 預覽 → 確認匯入。支援多門課，同版內容衝突及降版會停止，相同內容重試不重複，升版保留進度。
- 讀書計畫連結實際章節理解進度與手動 A／B／C／F 熟悉度；答對一題不自動升等。
- 教材與進度備份／合併還原，原始 TXT／MD／圖片／PDF 本地預覽。DOCX 可選檔，此靜態版不解析其文字。

主版面以課程與接續學習為主，匯入和原始教材預覽在右。兩個原站的程式碼複製進 modules/，不是跳轉原站。番茄鐘背景始終保留原版。原先約 6.7 MB 的單檔已拆為 8.5 KB 入口、獨立程式、樣式與 18 個原始素材，素材未重新壓縮；背景載入不阻擋計時器。

## 尚未完成

正式版本已確定需要登入帳號及手機／電腦跨裝置同步；目前尚未接上帳號與雲端資料服務，仍使用瀏覽器儲存。

今天與行事曆仍為標示清楚的示範資料。個人行程編輯、課表匯入、假日、提醒、自動排程尚未完成。讀書計畫目前追蹤進度，尚未自動安排時段。後續 AI 排程需先預覽整週，經使用者確認再加入行事曆。

原版選擇題與數值題可在前端判分。即時 AI 推導／圖片批改未部署後端，介面會說明未連接。舊學習模組 backend/ 僅保留原始程式參考，沒有啟用，GitHub Pages 不執行 Python。

## 教材與資料

使用 ChatGPT／Gemini 整理教材，不需要網站模型 API。參考 skills/blanktime-study-coach/SKILL.md 與 examples/minimal-package.json，生成教材包後匯入。自編範例不會預先加入正式課程。

教材與進度只存在目前瀏覽器，並非雲端同步；換裝置使用備份。清除網站資料會清除個人內容。原始教材預覽只保留在頁面記憶體，重新整理會清除。公開 Repository 不含私人教材或金鑰。建議一次在一個頁面編輯教材。

## 驗證

在本目錄執行 python -m http.server 8765，再開啟 http://127.0.0.1:8765/ 。

- node scripts/check.cjs
- node scripts/integration.test.cjs
- node modules/learning/tests/core.test.js
- node modules/learning/tests/figures.test.js

由 main 根目錄發布 GitHub Pages。

原番茄鐘：https://github.com/Barry3687/Pomodoro_Technique_Vibe_Coding
原逐觀念學習：https://github.com/Barry3687/stepwise-learning
