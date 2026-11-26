# 留白日程工作交接 — 2026-11-26

使用者看到剩餘額度約 12%，要求先儲存，已停止新增功能。請先讀 AGENTS.md 和本文件再繼續。最新這批變更只保存至開發分支，沒有刻意部署至正式 main。

## 2026-11-26 續作更新

使用者已要求繼續開發。沿用 codex/cloud-calendar-checkpoint-20261126，不受先前暫停要求限制；仍未完成正式 Google／雙裝置驗收，因此尚未部署 main。

- 修正重設進度時 completed／last 兩次儲存事件遺失 reset 意圖，以及重設請求送出期間新進度的 generation／revision 重定基準。
- 加入 scripts/cloud-app.test.cjs，實際載入帳號協調、儲存與 Repository，模擬 RPC／Auth，驗證遠端重設衝突、離線保留、首次拉取失敗後重試、帳號切換與延遲回覆隔離。
- 首次拉取資料失敗後仍保留已驗證帳號的待同步佇列；舊帳號失敗回覆不可改新帳號畫面。
- 學習頁完成題目與讀取接續位置時重讀儲存，避免已開教材頁將遠端清除的進度重新加入。
- 行程合併使用語意 JSON 比較，避免 Postgres jsonb 鍵排序造成假衝突。重新排程避開保留的已完成時段；部分重疊的休息不可再產生重疊事件。
- 手動編輯讀書時段保留 taskId／courseId／conceptId。四象限標籤靠近右緣改向左展開，390px 手機驗收已無橫向溢出（clientWidth／scrollWidth 均 375），預覽錯誤紀錄為空。
- 本輪 9 組檢查全部通過，包含 PGlite 真實 SQL 執行；Google 登入仍未完成，沒有假裝成正式驗收。
- README／cloud README／AGENTS 已更新開發版與正式版差異，修改的資源入口已更新快取版本。

已在對話直接詢問、尚待使用者回答：① 未完成排程要保留原時段標示，或提出整週調整供確認？② 是否已有 Google Cloud 專案？後續繼續時先收斂這兩題，不用問卷工具。

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

## 重要行事曆與 Google 設定續作

使用者已回答：未完成時段保留並標示；月曆只留作業、報告、期中考等重要事項，午晚餐休息不列其中；沒有 Google Cloud 專案。

已實作 calendarForDay／status／retainPlan：月週日行事曆詳情只列重要事項，今天仍顯示完整安排。新增 report 類別及 includeCalendar 手動選項；截止日與事項日期不同時另顯示截止紀錄，但不建立重複任務。重新產生排程保留已過時段及完成紀錄，不自動挪動。規則測試與本機一般入口已驗證：11/25 09–10 驗收報告維持原時段且標示未完成，月／週不含休息，11/27 正確顯示作業截止。所有驗收資料僅 localhost。

Google Cloud 專案 Blanktime 已實際建立，專案 ID blanktime-515909，無綁定帳單或啟用免費試用。Chrome 已登入使用者 Google 帳號。Google Auth Platform： https://console.cloud.google.com/auth/overview/create?project=blanktime-515909 。應用程式名稱已填「留白日程 Blanktime」，停在支援電子郵件下拉選單，準備讓使用者確認聯絡信箱。尚未提交品牌設定，未建立 OAuth client，未讀取任何 client secret。Chrome tab id 1531823897。接續先等使用者完成並歸還控制，不可操作待接手瀏覽器。

使用者追加明確限制：不能使用需要付費的功能。不得綁信用卡、開通付費方案或到期可能收費的試用；不得使用付費模型 API 或自動升級。免費額度不足改本機／手動／暫停，不付費。此規則已記入 AGENTS.md。Google Auth 支援信箱仍待使用者接手完成；本輪未操作瀏覽器。

## Google Auth 品牌設定完成，等待憑證手動接線

使用者回覆設定完成；已從正常 Google UI 確認品牌已建立，OAuth 總覽顯示尚未設定用戶端。已準備 Web OAuth 用戶端表單，尚未按建立：名稱 Blanktime Web，JavaScript origin https://barry3687.github.io，redirect URI https://fnewwyxoqmbylliycelr.supabase.co/auth/v1/callback，AI 代理選項未勾。Chrome tab 1531823897，網址 https://console.cloud.google.com/auth/clients/create?project=blanktime-515909 。

Supabase Google provider 編輯頁也已開好，IAB tab 3，https://supabase.com/dashboard/project/fnewwyxoqmbylliycelr/auth/providers?provider=Google 。Enable Sign in with Google 仍關閉；Client IDs 和 Client Secret 均空，Save 停用；Skip nonce checks／Allow users without an email 保持關閉。接下來交由使用者本人建立憑證，將 ID／Secret 直接貼到 Supabase，開啟 Google 登入並保存。不可讀取或要求密鑰傳入對話；不可操作待接手瀏覽器，等使用者歸還控制。未開通付費服務、未綁帳單。

## Google 已啟用，本機登入驗收待允許回傳網址

已從 Supabase 管理頁 Google ENABLED 與匿名公開 Auth settings googleEnabled=true 確認設定成功，未讀取密鑰。正式 main 仍為 047a67025979fb3a47cbb637029f12cce286bc43；最新開發分支此前為 11bc05e9fd9f92c1e7338eb5aec470f0c7320d96。

新增 scripts/preview-auth.py：只綁定 127.0.0.1:8765，傳回 /cloud/config.json 時覆寫 redirectUrl 為本機精確網址，原檔與正式設定不改。HTTP 記錄移除 query，避免一次性 OAuth code 出現在輸出。伺服器 exec session 45322 仍保留，之後若停掉按同命令重啟。Chrome 真實登入驗收 tab 1531823900，已開啟帳號對話框，Google 登入按鈕已可用，尚未按登入。

Supabase IAB tab 4 已打開 Add new redirect URLs，輸入 http://127.0.0.1:8765/，尚未按 Save URLs。此項新增登入回傳白名單屬安全設定，正等待使用者在對話確認；沒有要求手動接管。取得確認才按保存，驗收完移除這個臨時網址，保留正式網址。不能在正式驗收前合併 main。

本機伺服器路由已用正常 HTTP 驗證，正式 config 未變，公開 Google provider=true，Google SDK 正常載入。node scripts/check.cjs、integration.test.cjs、cloud-app.test.cjs 通過。另修正首頁及讀書計畫底部的過期建置中文字。

## 本機回傳網址已獲授權並保存，等使用者選 Google 帳號

使用者明確同意臨時增加 localhost redirect。Supabase URL Configuration 已從正常 UI 確認 Total URLs: 2，包含正式 GitHub Pages 網址及 http://127.0.0.1:8765/。原 Site URL 保持正式網址。原先 Playwright fill 後保存未出現在清單，改用 native typeText 加 Tab、保存後 waitFor 精確網址可見，已確認成功。測試結束仍須移除臨時網址。

Chrome tab 1531823900 已由正常網站按 Google 登入，進入 accounts.google.com 的多帳號選擇頁。自動審查拒絕代選特定帳號，理由為使用者尚未指定要用哪一個，多帳號選錯會讓同步資料綁錯身份。未繞過拒絕，將交接讓使用者自行選擇並完成登入。身份選擇前無任何雲端驗收寫入。IAB Supabase tab 4 保留；本機 server 45322 待續。

## 真實登入、雲端驗收與即時解析已完成

使用者手動完成 Google 帳號選擇後，Chrome localhost 帳號頁顯示已登入及已同步。scripts/preview-auth.py 新增隔離驗收入口 ?isolatedQa=1，僅本機回應的 storage.js 使用 sessionStorage，身份驗證仍由原 SDK 正常處理，不複製或讀取 token。Chrome 主頁 1531823900、隔離頁 1531823911 已驗證：09:05–10:05 報告真實同步，反向完成同步；番茄鐘開始後另一頁收到49:53倒數，另一頁暫停原頁收到49:48，重設同步回50:00；自編 demo-ratio 教材、1/1理解進度、C熟悉度同步成功。驗收報告已從正常入口移除，兩頁都空；番茄鐘已重設。demo-ratio 自編範例及其進度仍保留於登入帳號，不含私人教材。

使用者追加作答後立即顯示解析：lesson.js 已移除查看完整解析按鈕，任一有效作答都顯示正解及全部選項解析。實際以A答錯、B答對兩條路徑驗收；作答前 solutionVisible=false，兩次作答後皆true；未自動調整C熟悉度。更新教材HTML、JS及動態章節連結版本為20261126以避開舊頁快取。登入逾時改為白話提示並保留重新登入入口。

390px手機版根頁 clientWidth/scrollWidth均375，教材iframe均360，未橫向溢出，已還原viewport。沒有 Uncaught 錯誤。9組自動檢查全部通過。本次仍是同電腦兩獨立客戶端，手機實機、第二帳號、真實專注完成長時間雙裝置計數未測，不得過度宣稱。

Supabase IAB tab4已移除臨時localhost redirect，UI顯示Successfully removed、Total URLs:1，只剩正式GitHubPages網址，Site URL未變。local server session96944尚在；隔離頁已關閉。準備將候選版本儲存到開發分支並fast-forward main，接著驗證GitHubPages實際發布結果。
