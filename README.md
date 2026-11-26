# 留白日程 · Blanktime

網站：https://barry3687.github.io/blanktime/

把課表、重要行事曆、讀書計畫、逐觀念教材和原版番茄鐘放在同一個滿版深綠工作空間。僅使用免費功能，不綁付款方式、不啟用付費模型 API。

## 目前功能

- Google 登入；Supabase 依帳號保存整理後的課程、理解進度、A/B/C/F 熟悉度、行程及同一份番茄鐘狀態與紀錄。原始 PDF、Word、PPT、圖片不會上傳。
- 訪客模式只存在目前瀏覽器，與登入帳號快取分開；訪客資料需預覽確認才合併。
- 今天顯示完整課表、讀書、休息與彈性時間。手動時間可精確到 5 分鐘，三小時固定課程按一小時分段顯示，支援重複課表與停課日期。
- 月曆、週檢視與日期詳情只列重要事項，包含作業、報告、考試及手動指定事項；截止日與安排日不同時，另在截止日標示。休息與彈性不塞入行事曆。
- 已過但未完成的事項保留原日期、時段並標示「未完成」，不自動搬動。四象限只列使用者核對加入的事項，重要程度可調整。
- 一週規則排程先預覽、確認後加入每日安排；避開固定課表，使用 30／60 分鐘讀書單位，每次休息與每日獨立彈性時間至少 30 分鐘，排不下的任務明列待安排。這不是網站即時呼叫模型。
- ChatGPT／Gemini 教材包匯入：驗證、預覽、確認，支援多門課與版本檢查；重新匯入保留理解進度。教材與學習進度可備份與合併還原。
- 教學依序為白話理解、公式與符號、驗證題；長推導可展開。提交選擇題後，答對或答錯都立即顯示正確答案及各選項解析，作答前隱藏。理解完成須自己確認，不因單題答對就升為 A。
- 原版番茄鐘背景、城市、日夜、天氣、聲音、設定及次數統計保留，頂列與原頁共用一份倒數。跨頁／重整持續，登入後透過伺服器時間與版本檢查同步。

## 驗證與限制

2026-11-26 已完成真實 Google 登入及 Supabase 讀寫驗收。兩個獨立資料快取的頁面，實際驗證行程新增／完成／移除、整理後教材、理解進度、熟悉度及番茄鐘開始／暫停／重設的雙向同步。第二頁用 sessionStorage 保存獨立資料快取，沒有依賴第一頁的 localStorage 廣播；身份驗證仍使用正常 Google 登入。

這是同一台電腦上的兩個獨立客戶端，手機實機與另一個帳號的正式端到端測試尚未完成。390px 響應式檢查已通過，題目前後的解析顯示已從正常入口驗證。真實專注完成次數的長時間雙裝置結算仍待後續實機驗收；去重、衝突與 SQL 隔離有自動測試。

國定假日自動資料、系統通知與即時 AI 解題批改尚未提供。假日可人工新增或核對後匯入；網頁關閉後不保證播音或提醒。未登入時，清除瀏覽器資料會清除訪客內容。原始教材預覽只保存在頁面記憶體。

## 開發檢查

一般本機預覽：`python -m http.server 8765`。

真實登入驗收：`python scripts/preview-auth.py`。需先取得使用者確認，暫時允許 `http://127.0.0.1:8765/` 作為 Supabase 回傳網址，驗收後移除。`?isolatedQa=1` 的第二頁只在這個本機伺服器使用獨立資料快取，不改正式設定、也不讀取或複製登入憑證。HTTP 紀錄不輸出登入回傳 query。

- `node scripts/check.cjs`
- `node scripts/integration.test.cjs`
- `node scripts/planner.test.cjs`
- `node scripts/storage.test.cjs`
- `node scripts/cloud.test.cjs`
- `node scripts/cloud-app.test.cjs`
- `node scripts/cloud-sql.test.cjs`（另安裝 @electric-sql/pglite 或傳入 dist/index.cjs 路徑）
- `node modules/learning/tests/core.test.js`
- `node modules/learning/tests/figures.test.js`

由 main 根目錄發布 GitHub Pages。公開庫只有程式與自編範例；cloud/config.json 是公開 publishable key，沒有 service_role、Google client secret 或個人教材。

教材格式與教練：skills/blanktime-study-coach/。舊 modules/learning/backend/ 只保留原始參考，不在 GitHub Pages 執行。

原番茄鐘：https://github.com/Barry3687/Pomodoro_Technique_Vibe_Coding
原逐觀念學習：https://github.com/Barry3687/stepwise-learning
