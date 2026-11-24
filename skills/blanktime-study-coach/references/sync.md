# 同步與驗收

## 執行方式

使用者目前選擇在聊天環境完成 AI 整理，再匯入網站。除非使用者另行改變選擇，不新增模型服務費用或呼叫 Groq/OpenAI/Gemini API。一般網站資料匯入可由既有後端執行，與模型 API 分開。

先查明目的地是留白日程、本機循序漸進，或線上私人課程。網址和 API 只能依專案及當前 UI 確認。

## 已核對的循序漸進介接

公開程式來源 https://github.com/Barry3687/stepwise-learning 。本機範例目錄 lecture-step-by-step，須從目前工作區尋找實際 checkout。

既有 content/FORMAT.md 規定 lesson.json，scripts/chapters.js 匯入工具使用 assets/js/core.js 驗證。將教材包 lessons 中一個章節完整匯出為 JSON，於目的地執行 node scripts/chapters.js add <絕對檔案路徑>，再執行 node scripts/chapters.js check。一次匯入一章，逐章回報結果。該工具建立章節頁、來源與教學 JSON 並更新目錄，首頁與課程介面能讀取該格式。

既有章節 add 會拒絕同 ID，更新須核對差異、保留 ID 及進度。先備 ID 的跨科命名限制依目的地程式調整。study 規劃資料尚需留白日程匯入器支援，不可宣稱章節 add 已同步讀書排程。

私人線上版本原始碼在 online-ai/。目前已核對 API 為 courses/save 及 learning/plan、lesson、answer 等，plan/lesson 會呼叫模型。courses/save 僅保存來源及草稿，不能當成教材包匯入器使用。尚未找到可直接寫入完整 lessons 和 study 的正式匯入 API，因此不可猜端點或把教材包送進既有模型規劃流程。完成網站匯入功能後再更新本參考。

## 驗收與完成狀態

格式驗證後還需核對一課的來源、題目答案、圖表及推導。目的地實際匯入後，驗證課程數、觀念數、首課可讀、作答前答案隱藏、作答回饋與下一課切換。更新匯入前後抽查既有完成位置及自評保留。

學生私人教材不能因同步而進入公開倉庫。目的地不明或缺私人匯入入口時，可完成教材包與本機驗證，回報網站端尚待介接。Git commit、push 及發布分別核對，只有公開或私人網址上能讀取新版本時才回報已上線。

同一教材包重試時先比對課程 ID/revision/內容與既有狀態。個別章節失敗停止並保留已成功清單，重試跳過內容相同項目。匯入不得覆蓋考試日期、手動行程、自評或作答紀錄。

