/**
 * AI Pulse — 前端交互
 * - 主题切换
 * - 趋势主线切换
 * - 信号过滤
 * - 时间线筛选
 */

// ── 主题切换 ──────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;

function getPreferredTheme() {
  const saved = localStorage.getItem('ai-pulse-theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem('ai-pulse-theme', theme);
  const icon = root.querySelector('.icon');
  if (themeToggle && icon) {
    // 切换 SVG 图标
    if (theme === 'dark') {
      themeToggle.innerHTML = '<svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
    } else {
      themeToggle.innerHTML = '<svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    }
  }
}

setTheme(getPreferredTheme());

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// ── 趋势主线 Tab 切换 ─────────────────
const trackTabs = document.getElementById('track-tabs');
if (trackTabs) {
  const tabs = trackTabs.querySelectorAll('.track-tab');
  const panels = document.querySelectorAll('[data-track-panel]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 更新 active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const track = tab.dataset.track;

      // 切换面板
      if (panels.length > 0) {
        panels.forEach(p => {
          p.classList.toggle('hidden', p.dataset.trackPanel !== track);
        });
      }

      // 时间线筛选
      const timelineRows = document.querySelectorAll('[data-track-filter]');
      if (timelineRows.length > 0) {
        timelineRows.forEach(row => {
          if (track === 'all') {
            row.style.display = '';
          } else {
            row.style.display = row.dataset.trackFilter === track ? '' : 'none';
          }
        });
      }
    });
  });
}

// ── 信号过滤 ──────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const signalCards = document.querySelectorAll('.signal-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;

    signalCards.forEach(card => {
      let show = true;
      if (filter === 'tier1') {
        show = card.querySelector('.tier-badge')?.textContent === '一手';
      } else if (filter === 'cn') {
        show = !!card.querySelector('.region-cn');
      }
      card.style.display = show ? '' : 'none';
    });
  });
});

// ── 动画延迟 ──────────────────────────
document.querySelectorAll('.signal-card').forEach((card, i) => {
  card.style.setProperty('--i', i);
});

// ── Scroll reveal ──────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.trend-card, .scout-card, .theme-card').forEach(el => {
  observer.observe(el);
});
