# Google 登入與跨裝置同步準備

狀態：資料庫結構及客戶端介面已建立，尚未啟用正式登入／同步。缺少使用者自己的 Supabase 專案及 Google OAuth 設定。本目錄不會自動執行，現有網站維持原本本機資料功能。

## 已確認的產品需求

- Google 帳號登入，手機和電腦使用同一帳號。
- 同步整理好的課程、理解進度及 A/B/C/F 熟悉度，不傳原始 PDF、Word、PPT 或圖片。
- 同一個番茄鐘：專注／休息、開始／暫停／剩餘時間與完成次數跨裝置一致。
- 同步資料屬於個人，不放公開 GitHub。資料庫以登入者 ID 分隔，匿名訪客無權讀寫。

## 需要的服務設定

1. 建立使用者自己的 Supabase 專案；在 SQL Editor 執行 schema.sql。
2. 於 Google Auth Platform 建立 Web OAuth client。使用基本 openid/email/profile scopes，設定 OAuth consent screen，測試階段加入自己的測試帳號。
3. Google OAuth 的 authorized redirect URI 為 Supabase 後台提供的 callback。Google client ID／secret 只填 Supabase 的 Google provider 設定，secret 不放 GitHub 或對話。
4. Supabase Auth URL 設定 Site URL 與允許的 redirect URL： https://barry3687.github.io/blanktime/ 。
5. config.example.json 只放專案 URL 和 publishable key。這不是 service_role／secret key。實際接線時再新增 config.json，啟用正式登入前先跑雙帳號及雙裝置驗收。

官方設定步驟：https://supabase.com/docs/guides/auth/social-sign-in/auth-google
資料隔離：https://supabase.com/docs/guides/database/postgres/row-level-security

## 資料表與衝突規則

blanktime_documents 存 course、progress、mastery、timer 四類資料，timer 的 ID 固定 shared。原始教材沒有表格或檔案儲存入口。schema.sql 啟用 RLS；客戶端只有本人的 SELECT 權限，寫入透過檢查登入者的函式。

每次寫入攜帶預期 revision；另一台裝置已改過時回傳衝突，不能無聲覆蓋。成功寫入的 operation UUID 會保存回應，網路中斷重送相同請求不重複套用。客戶端不接受較舊版本回傳覆蓋新狀態。初次登入的舊資料合併需要使用者預覽確認；課程同版本不同內容須列出衝突，完成進度合併，番茄鐘紀錄依 session ID 去重。熟悉度與進度重設不可直接用集合聯集處理，需另外確認取代語義。

倒數同步共同的 end 時間戳，依伺服器時鐘校準，不每秒寫入資料庫。視覺／音效設定可以各裝置不同；須同步的是計時狀態與紀錄。完成結算沿用原版 session ID，以版本寫入防止兩台各記一次。關閉頁面後不保證播音或推播。

## 接上正式網站前仍需完成

- Google OAuth 真實登入、回傳及登出；學習模組與番茄鐘的帳號隔離快取。
- 將既有 localStorage 寫入改接此介面、顯示保存中／已同步／離線狀態，登入後預覽合併本機資料。
- 訂閱變更或固定短間隔重抓，背景轉前景即拉最新狀態；禁止離線裝置排隊重放舊的開始／暫停覆蓋新計時。離線仍可顯示最後的倒數，修改同步計時需連線。
- 執行實際資料庫安全測試：匿名、帳號 A／B 隔離、ID 偽造、重送操作、同時完成及同步衝突。
- 兩台真實裝置測試開始、暫停、繼續、完成、斷網、重新登入與切換帳號。完成前不可宣稱跨裝置已可用。

本機介面測試：node scripts/cloud.test.cjs 。目前測試使用假資料服務，只驗證協定、衝突重試與合併規則，不能取代實際 Supabase 或 Google 驗收。

## 本機資料庫驗證紀錄

使用 @electric-sql/pglite 0.6.0 實際執行 schema.sql，並建立測試用 auth.users、auth.uid()、anon／authenticated 角色。已通過匿名拒絕存取、A/B 帳號隔離、直接寫入阻擋、跨帳號 operation UUID 不洩漏資料、請求重送去重及版本衝突測試。此環境沒有真實 Google OAuth、Supabase Auth token 或兩個實體連線；不能取代正式服務的安全驗收。

執行 node scripts/cloud-sql.test.cjs，或 node scripts/cloud-sql.test.cjs /absolute/path/to/pglite/dist/index.cjs 。測試用套件不隨網站部署，也不增加網站的前端依賴。
