# 留白日程工作交接 — 2026-11-26

使用者看到剩餘額度約 12%，要求先儲存，已停止新增功能。請先讀 AGENTS.md 和本文件再繼續。最新這批變更只保存至開發分支，沒有刻意部署至正式 main。

## 已有的正式服務

- 正式網站：https://barry3687.github.io/blanktime/
- GitHub：https://github.com/Barry3687/blanktime
- Supabase 專案：blanktime，ID fnewwyxoqmbylliycelr，Tokyo，Free 組織。
- Project URL：https://fnewwyxoqmbylliycelr.supabase.co
- Dashboard：https://supabase.com/dashboard/project/fnewwyxoqmbylliycelr
- 使用者已親自設定資料庫密碼並建立專案，密碼不可讀取、公開或要求傳到對話。
- cloud/config.json 只含公開 publishable key 與網址，不含 secret／service_role key。
- SQL Editor 已成功執行最新版 cloud/schema.sql，包含 course/progress/mastery/timer/schedule。最後結果為 Success. No rows returned。
- Site URL 與唯一 redirect URL 都設為 https://barry3687.github.io/blanktime/。
- Google provider 仍 Disabled：缺 Google Cloud OAuth Web client ID／secret。Callback：https://fnewwyxoqmbylliycelr.supabase.co/auth/v1/callback 。不得宣稱 Google 登入或真實跨裝置驗收完成。

## 本批新增但仍待整體驗收的程式

1. assets/storage.js：訪客／每個使用者 UUID 的快取命名空間，共用於子頁面，換帳號不讀另一帳號的課程。
2. assets/cloud-app.js：Google PKCE 登入接線、每帳號獨立 Repository、每 5 秒重抓、前景恢復同步、待同步佇列、衝突保留、訪客資料預覽合併。Google 未啟用時登入按鈕明示設定中。尚缺實際 Google／雙裝置端到端測試。
3. 番茄鐘保留原版圖像與設定，timer.js/bridge.js 接上伺服器時鐘與共享 CAS 計時狀態；已登入時斷線禁止開始／暫停寫入，避免排隊重放舊命令。仍需真實帳號與兩台裝置驗收。
4. planner-core.js / planner.js：真實月曆、週清單、今天全日安排、新增／編輯／完成／移除事項、每週固定課表、停課例外、課表 JSON 匯入與複製整理指令、依期限的四象限。
5. 讀書計畫可預覽一週規則排程，30/60 分鐘讀書、至少 30 分鐘休息、每天另留 30 分鐘彈性；避開固定課表、顧及先備與期限、列出排不下任務，確認後才加入行事曆。這是規則排程，不是網站即時呼叫模型。
6. assets/value.js：語意 JSON 比對（Postgres jsonb 會排序物件鍵，不能用原始 JSON.stringify 比對同版教材）。
7. 原始假月曆／今天示範資料已移除，未新增實際資料時顯示空狀態。國定假日仍未自動連接，週末可辨識，假日可人工新增或核對後匯入。瀏覽器通知未完成。

## 已做驗證

- node scripts/check.cjs：通過。
- node scripts/integration.test.cjs：通過，含 JSON 鍵順序不同的同版教材重匯入。
- node scripts/cloud.test.cjs：通過 CAS 衝突、重送去重、舊回覆、錯帳號資料拒絕、離線保留；模擬服務，不是實際登入。
- node scripts/storage.test.cjs：通過 guest/A/B 快取與刪除隔離。
- node scripts/planner.test.cjs：通過課表、假日排除、先備、30/60 分鐘、30 分鐘休息／彈性、期限、不排過去時間及待安排清單。
- node scripts/cloud-sql.test.cjs ../tmp/blanktime-db-check/package/dist/index.cjs：本機 PGlite 0.6.0 測試通過匿名拒絕、A/B 隔離、禁止直接寫入、重送去重和版本衝突。由專案外啟動時請按 cwd 修正套件路徑。
- 正式 Supabase API 檢查：Auth settings 200 且 googleEnabled=false；匿名查詢 private table／RPC 都回 401。
- 本機瀏覽器已從正常入口新增「驗收：生成式 AI」週四 09–12 課表，12/03 停課；新增「驗收：實驗報告」11/27 23:59 期限，確認即將到期與四象限；先預覽後確認加入一週讀書時段，課表分三段一小時顯示。驗收資料只在 localhost 瀏覽器，沒有放進正式課程或公開資料。
- 最後修正：預覽排序改按日期時間、待辦已排程會顯示「已有排程」、不能提前到待辦指定日期前、Repository 每帳號／每輪登入獨立並拒絕錯 user_id 回傳。純程式測試已通過，這幾個最後修正還需再看實際畫面。

## 繼續時優先做

1. 查看此開發分支 diff，核對 script 順序、child frame 儲存共用、登入 epoch 防止舊帳號 RPC 回覆污染新帳號。
2. 補完整 cloud-app 端到端測試，尤其 reset 進度／熟悉度衝突、離線佇列、訪客合併、切換帳號、兩裝置同時完成番茄鐘。不得用測試登入繞過正式 Google 授權。
3. 行事曆手機排版、匯入錯誤、刪除還原、課表調課流程、規則排程完成任務後的剩餘工時及備份範圍仍可改善；目前不可宣稱全部完成。
4. 引導建立 Google Cloud Web OAuth client；需要本人登入、條款或新密鑰時才交接。client secret 只輸入 Supabase 管理頁，不寫 GitHub／對話。Supabase Google provider 現在尚未啟用。
5. 設定好 Google 後，再接真實帳號驗證與手機／電腦測試，確認後才合併 main／發布新版。

## 執行中的工具

本機 HTTP server 127.0.0.1:8765，先前 exec session_id 94615。若仍在運作可重用，否則重新啟動。IAB Supabase tab id 3；本機驗收 tab id 4。瀏覽器 runtime 可能因閒置重設，需依 CUA 規則重新取得，不要操作頁面隱藏狀態或網路 API。

## 重要使用者偏好

問題直接在對話問，不要使用問卷小視窗。網站滿版、深綠、資訊密集但重點先顯示；小頂列、原版番茄鐘背景保留；一天安排全顯示。教學白話→公式用法／簡要符號與來源→題目。Google 登入、只同步整理後課程，手機與電腦同一倒數和紀錄。AI 排程須先預覽確認。使用者要求保留約 10% 額度；模型不能讀取實際帳號額度。
