
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
      root.dataset.currentPage = page;
      if (page === 'focus') requestAnimationFrame(() => document.getElementById('pomodoro-frame')?.contentWindow?.BlanktimePomodoro?.refresh());
      if (page === 'study') window.dispatchEvent(new Event('blanktime:study'));
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
    

    const frame = document.getElementById('pomodoro-frame');
    const measureChrome = () => root.style.setProperty('--bt-chrome-height', (root.querySelector('.bt-header').offsetHeight + root.querySelector('.bt-timer-strip').offsetHeight) + 'px');
    const chromeObserver = new ResizeObserver(measureChrome);
    chromeObserver.observe(root.querySelector('.bt-header'));
    chromeObserver.observe(root.querySelector('.bt-timer-strip'));
    measureChrome();
    function timerAPI() { return frame.contentWindow?.BlanktimePomodoro; }
    root.querySelector('[data-timer-toggle]').onclick = () => timerAPI()?.toggle();
    root.querySelector('[data-timer-add]').onclick = () => timerAPI()?.addMinute();
    function renderTimer() {
      const t = timerAPI()?.snapshot();
      root.querySelector('[data-timer-toggle]').disabled = !t;
      root.querySelector('[data-timer-add]').disabled = !t;
      if (!t) return;
      const sec = Math.ceil(t.remaining / 1000);
      const time = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
      const phase = t.phase === 'focus' ? '專注' : '休息';
      const label = t.status === 'running' ? '正在' + phase : t.status === 'paused' ? phase + '已暫停' : '準備' + phase;
      root.querySelectorAll('[data-timer-value]').forEach(n => n.textContent = time);
      root.querySelectorAll('[data-timer-state]').forEach(n => n.textContent = label);
      root.querySelector('[data-timer-toggle]').textContent = t.status === 'running' ? '暫停' : t.status === 'paused' ? '繼續' : '開始';
    }
    setInterval(renderTimer, 250);
    frame.addEventListener('load', renderTimer);
  })();

