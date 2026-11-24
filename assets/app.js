
  (() => {
    const root = document.getElementById("blanktime");
    const pages = [...root.querySelectorAll("[data-page]")];
    const panels = [...root.querySelectorAll("[data-panel]")];
    const views = [...root.querySelectorAll("[data-view]")];
    const calendars = [...root.querySelectorAll("[data-calendar]")];
    const month = root.querySelector('[data-calendar="month"]');
    for (const day of ["一", "二", "三", "四", "五", "六", "日"]) {
      const heading = document.createElement("span");
      heading.textContent = day;
      month.append(heading);
    }
    for (let index = 0; index < 36; index += 1) {
      const date = index - 5;
      const cell = document.createElement("div");
      if (date > 0) cell.textContent = String(date);
      if (date === 11) cell.className = "bt-active-date";
      if (date === 12) {
        const label = document.createElement("em");
        label.textContent = "期中考・報告";
        cell.append(label);
      }
      month.append(cell);
    }
    function choosePage(page) {
      for (const button of pages) button.setAttribute("aria-pressed", String(button.dataset.page === page));
      for (const panel of panels) panel.hidden = panel.dataset.panel !== page;
    }
    function chooseView(view) {
      for (const button of views) button.setAttribute("aria-pressed", String(button.dataset.view === view));
      for (const calendar of calendars) calendar.hidden = calendar.dataset.calendar !== view;
    }
    function saveSelection() {
      const page = pages.find(button => button.getAttribute("aria-pressed") === "true").dataset.page;
      const view = views.find(button => button.getAttribute("aria-pressed") === "true").dataset.view;
      try {
        localStorage.setItem("blanktime:view:v1", JSON.stringify({ privateContent: { page, view } }));
      } catch {}
    }
    function restore(state) {
      const { page, view } = state?.privateContent ?? {};
      if (pages.some(button => button.dataset.page === page)) choosePage(page);
      if (views.some(button => button.dataset.view === view)) chooseView(view);
    }
    for (const button of pages) button.addEventListener("click", () => {
      choosePage(button.dataset.page);
      saveSelection();
    });
    for (const button of views) button.addEventListener("click", () => {
      chooseView(button.dataset.view);
      saveSelection();
    });
    try { restore(JSON.parse(localStorage.getItem("blanktime:view:v1") || "null")); } catch {}
    

    const minute = 60_000;
    const duration = { focus: 50 * minute, rest: 30 * minute };
    const timer = { phase: "focus", deadline: null, remaining: duration.focus, started: false };
    const timeDisplays = root.querySelectorAll("[data-timer-value]");
    const stateDisplays = root.querySelectorAll("[data-timer-state]");
    const toggleButtons = root.querySelectorAll("[data-timer-toggle]");
    const form = root.querySelector("[data-timer-form]");

    function resetTimer() {
      Object.assign(timer, { phase: "focus", deadline: null, remaining: duration.focus, started: false });
    }

    function syncTimer(now) {
      if (timer.deadline === null) return;
      if (now >= timer.deadline && timer.phase === "focus") {
        timer.phase = "rest";
        timer.deadline += duration.rest;
      }
      if (now >= timer.deadline) {
        resetTimer();
        return;
      }
      timer.remaining = timer.deadline - now;
    }

    function renderTimer() {
      const running = timer.deadline !== null;
      const status = running ? (timer.phase === "focus" ? "正在專注" : "正在休息")
        : (timer.started ? "已暫停" : "等待開始");
      const seconds = Math.ceil(timer.remaining / 1000);
      const display = String(Math.floor(seconds / 60)).padStart(2, "0") + ":"
        + String(seconds % 60).padStart(2, "0");
      for (const output of timeDisplays) output.textContent = display;
      for (const output of stateDisplays) {
        if (output.textContent !== status) output.textContent = status;
      }
      for (const button of toggleButtons) button.textContent = running ? "暫停" : timer.started ? "繼續" : "開始";
    }

    for (const button of toggleButtons) button.addEventListener("click", () => {
      const now = Date.now();
      syncTimer(now);
      timer.started = true;
      timer.deadline = timer.deadline === null ? now + timer.remaining : null;
      renderTimer();
    });
    root.querySelector("[data-timer-add]").addEventListener("click", () => {
      syncTimer(Date.now());
      timer.remaining += minute;
      if (timer.deadline !== null) timer.deadline += minute;
      renderTimer();
    });
    root.querySelector("[data-timer-reset]").addEventListener("click", () => {
      resetTimer();
      renderTimer();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      syncTimer(Date.now());
      duration.focus = form.elements.focus.valueAsNumber * minute;
      duration.rest = form.elements.rest.valueAsNumber * minute;
      if (!timer.started) timer.remaining = duration.focus;
      root.querySelector("[data-timer-settings]").textContent = timer.started
        ? "已套用，下個階段開始生效。" : "已套用新的專注與休息時間。";
      renderTimer();
    });
    renderTimer();
    const ticker = setInterval(() => {
      if (!root.isConnected) {
        clearInterval(ticker);
        return;
      }
      if (timer.deadline !== null) {
        syncTimer(Date.now());
        renderTimer();
      }
    }, 200);
  })();

