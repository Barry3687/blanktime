# 教材包 v1

新增介接格式為 blanktime.study-package/v1，網站匯入器須明確支援該版本。既有循序漸進章節可取出 lessons 逐章使用 chapters.js 匯入。

根層欄位

- format 固定為 blanktime.study-package/v1。
- courseId 穩定的英文小寫連字號 ID。
- title 為科目或教材名稱。
- revision 正整數，更新內容時遞增。
- warnings 為來源限制的字串陣列。
- lessons 為既有循序漸進 lesson.json 結構的陣列。
- study 為章節規劃陣列，每筆包含 chapterId、mastery（A/B/C/F 或 null，未評估時使用 null）及 tasks。
- tasks 每筆含 conceptId、minutes（30 或 60）、prerequisiteIds（同一教材包內且在本觀念之前的觀念 ID 陣列）。

每章含 id、title、sources、concepts。chapter ID 如 ch01-mos，觀念如 ch01-c01。跨章使用不同章節數字避免碰撞，多科並存時以 courseId 加觀念 ID 作為完整關聯鍵。

來源含 id、title、pages、pdfPages。頁碼未知時填「未標頁碼」並寫 warnings；照片用檔名及圖片序號；PPT 記錄投影片編號。sources 只列實際可讀來源。

每個觀念含 id、title、goal、prerequisites（文字陣列）、sources（來源 ID）、sections、quiz。sections 每筆含 title、origin、blocks。文字和 LaTeX 公式使用 text/formula 區塊，區塊內容放 text。圖片使用 image 區塊，src 為 assets/images/ 下的實際檔案路徑，並附 alt 和 caption。支援的 diagram 格式沿用目的地 content/FORMAT.md，不能憑空增加圖表類型。

quiz 含 prompt、options（四個不重複字串）、answer（0 至 3）、hint、explanations（四個字串）。答案與解析獨立於課文，UI 先隱藏，選項由網站確定性判分。文字推導只有經 AI 或人工實際批改後才能標記已批改。

至少包含先備複習、用途與直覺、公式與條件、必要推導或示範、考試精簡寫法。來源無公式時以該科目的必要定義或操作條件代替。

範例形狀見 examples/minimal-package.json，該例為自行編寫的驗收教材，僅供檢查匯入格式，正式內容須由使用者來源製作。

## 更新及進度

教材包僅更新課程內容與規劃建議。學生進度獨立儲存，鍵為 courseId、chapterId、conceptId，至少區分閱讀位置、選項作答、是否求助、是否查看解析、自評熟悉度及推導批改狀態。缺少欄位代表未提供更新，不可視為清除。重新命名維持 ID；實質替換內容時增加 revision，保留舊紀錄並提示重學。匯入相同 courseId/revision 與內容應為無變更，revision 相同但內容不同應要求核對。

PDF/PPT/照片原檔及附件不內嵌 JSON，與教材包一起保存在使用者指定私人位置。文字及公式禁止當成可執行 HTML；網站需清理 Markdown/HTML 或使用安全文字區塊。圖片亦需核對路徑及權限。

