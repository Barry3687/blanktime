# 留白日程 · Blanktime

結合課表、行事曆、讀書計畫、逐觀念教材與番茄鐘的生成式 AI 期末專案。

網站 https://barry3687.github.io/blanktime/

## 目前可操作

- 今天、行事曆、教材與學習、讀書計畫與番茄鐘頁面切換。
- 月曆／週清單切換。
- 共用番茄鐘，切換頁面繼續倒數，支援暫停、繼續、加時及設定。
- 留白日程教材教練 Skill、教材包範例與格式檢查工具。

畫面行程與讀書計畫目前使用示範資料。教材匯入、個人行程編輯、自動排程與進度整合待開發。番茄鐘目前僅在本頁開啟期間運作，重新整理會重設。此版參考窗邊小憩的配置，採簡化版番茄鐘。

## 規劃中的主流程

在 ChatGPT／Gemini 整理教材，匯入章節與逐觀念教學，透過 A／B／C／F 評估熟悉度，再依課表安排 30／60 分鐘任務。每段正式休息至少 30 分鐘，每天另保留至少一段連續 30 分鐘的彈性時間。手動行程可精確至 5 分鐘，三小時課程以相連的一小時區塊呈現。到期提醒與重要／緊急四象限顯示使用者新增的事項。

## 本機使用

以靜態伺服器開啟根目錄，例如 python -m http.server 8000，瀏覽 http://localhost:8000 。

檢查指令

- node scripts/check.cjs
- node skills/blanktime-study-coach/scripts/validate-package.cjs skills/blanktime-study-coach/examples/minimal-package.json

## 教材與隱私

本儲存庫公開程式碼、規則及自編格式範例。私人教材、作答紀錄、考試資料與 API 金鑰應存於個人工作區。教材整理沿用聊天服務，網站目前沒有模型 API 連線。

原第九週作業 https://github.com/Barry3687/stepwise-learning

