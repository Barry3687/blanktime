(() => {
  'use strict';
  window.BlanktimePomodoro = {
    snapshot() {
      const t = state.timer;
      return {phase:t.phase, status:t.status, remaining:t.status === 'running' ? Math.max(0,t.end-timerNow()) : t.remaining};
    },
    toggle() { act(state.timer.status === 'running' ? 'pause' : 'start'); },
    addMinute() {
      unlockAudio();
      return mutate(() => {
        finish();
        const t = state.timer, max = t.phase === 'focus' ? 10800000 : 3600000;
        if (t.total + 60000 > max) { notify('已達這個模式的時間上限。'); return; }
        t.total += 60000; t.remaining += 60000;
        if (t.status === 'running') t.end += 60000;
      });
    },
    refresh() { resizeRain(); },
    settings() { $('openSettings').click(); }
  };
})();
