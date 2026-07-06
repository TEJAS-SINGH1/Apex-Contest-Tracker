// UI Drawing, DOM Rendering, Card building, and Countdown Timers

import { Storage } from './storage.js';
import { Calendar } from './calendar.js';

// Timer repository to prevent memory leaks from overlapping intervals
let activeIntervals = [];

function clearAllIntervals() {
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

export const UI = {
  // 1. Format dates elegantly
  formatDate(dateStr) {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateStr).toLocaleString('en-US', options);
  },

  // 2. Format duration
  formatDuration(mins) {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
  },

  // 3. Update User Profile Section on Sidebar
  updateSidebarProfile(settings) {
    const handleDisplay = document.getElementById('user-cf-handle-display');
    const ratingDisplay = document.getElementById('user-cf-rating-display');
    const avatarPlaceholder = document.getElementById('cf-avatar-placeholder');

    if (settings.cfHandle || settings.leetcodeHandle || settings.codechefHandle || settings.atcoderHandle) {
      const handles = [];
      if (settings.cfHandle) handles.push(settings.cfHandle);
      if (settings.leetcodeHandle) handles.push(settings.leetcodeHandle);
      if (settings.codechefHandle) handles.push(settings.codechefHandle);
      if (settings.atcoderHandle) handles.push(settings.atcoderHandle);
      
      handleDisplay.textContent = handles.slice(0, 2).join(' / ');
      
      const ratings = [];
      if (settings.cfHandle) ratings.push(`CF: ${settings.cfRating || '--'}`);
      if (settings.leetcodeHandle) ratings.push(`LC: ${settings.leetcodeRating || '--'}`);
      if (settings.codechefHandle) ratings.push(`CC: ${settings.codechefRating || '--'}`);
      if (settings.atcoderHandle) ratings.push(`AC: ${settings.atcoderRating || '--'}`);
      
      ratingDisplay.textContent = ratings.join(' | ');
      
      let initials = '';
      if (settings.cfHandle) initials += settings.cfHandle.slice(0, 1).toUpperCase();
      if (settings.leetcodeHandle) initials += settings.leetcodeHandle.slice(0, 1).toUpperCase();
      if (settings.codechefHandle && initials.length < 2) initials += settings.codechefHandle.slice(0, 1).toUpperCase();
      if (settings.atcoderHandle && initials.length < 2) initials += settings.atcoderHandle.slice(0, 1).toUpperCase();
      if (initials.length === 0) initials = 'AP';
      
      avatarPlaceholder.textContent = initials.slice(0, 2);
    } else {
      handleDisplay.textContent = 'Setup Handles';
      ratingDisplay.textContent = 'Rating: --';
      avatarPlaceholder.textContent = 'AP';
    }
  },

  // 4. Update the Next Up Hero Banner
  updateNextUpBanner(contests, watchlistIds) {
    const container = document.getElementById('next-up-container');
    if (!container) return;

    // Filter watched contests that are upcoming or active
    const now = Date.now();
    const watched = contests
      .filter(c => watchlistIds.includes(c.id) && (new Date(c.startTime).getTime() + c.duration*60*1000) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (watched.length === 0) {
      container.innerHTML = `
        <div class="banner-overlay-placeholder">
          <h3>No Watchlist Contests</h3>
          <p>Star upcoming coding contests in the Contest Hub to track them here!</p>
        </div>
      `;
      return;
    }

    const next = watched[0];
    const isCoding = new Date(next.startTime).getTime() <= now;

    container.innerHTML = `
      <div class="next-up-card-content">
        <div class="next-up-info">
          <span class="next-up-badge">${isCoding ? '🔴 Currently Active' : '⏱️ Next Contest'}</span>
          <h3 class="next-up-title">${next.name}</h3>
          <div class="next-up-meta">
            <div class="next-up-meta-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${this.formatDate(next.startTime)}</span>
            </div>
            <div class="next-up-meta-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${this.formatDuration(next.duration)}</span>
            </div>
            <div class="next-up-meta-item">
              <span class="platform-badge ${next.platform}">${next.platform.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div class="next-up-countdown">
          <div class="countdown-label">${isCoding ? 'Ends In' : 'Starts In'}</div>
          <div class="countdown-digits" id="hero-countdown-digits">
            00:00:00:00
          </div>
        </div>
      </div>
    `;

    // Start ticking countdown timer
    const digitsContainer = document.getElementById('hero-countdown-digits');
    const targetTime = isCoding 
      ? new Date(next.startTime).getTime() + next.duration * 60 * 1000 
      : new Date(next.startTime).getTime();

    const updateTimer = () => {
      const msLeft = targetTime - Date.now();
      if (msLeft <= 0) {
        digitsContainer.innerHTML = `<span>00</span>:<span>00</span>:<span>00</span>:<span>00</span>`;
        // Refresh banner
        setTimeout(() => this.updateNextUpBanner(contests, watchlistIds), 1000);
        return;
      }

      const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
      const hrs = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const mins = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
      const secs = Math.floor((msLeft % (60 * 1000)) / 1000);

      digitsContainer.innerHTML = `
        <div class="countdown-unit"><span>${days.toString().padStart(2, '0')}</span><span>Days</span></div>:
        <div class="countdown-unit"><span>${hrs.toString().padStart(2, '0')}</span><span>Hrs</span></div>:
        <div class="countdown-unit"><span>${mins.toString().padStart(2, '0')}</span><span>Mins</span></div>:
        <div class="countdown-unit"><span>${secs.toString().padStart(2, '0')}</span><span>Secs</span></div>
      `;
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    activeIntervals.push(interval);
  },

  // 5. Render Watchlist on Dashboard
  renderDashboardWatchlist(contests, watchlistIds) {
    const container = document.getElementById('dashboard-watchlist-container');
    if (!container) return;

    const now = Date.now();
    const watched = contests
      .filter(c => watchlistIds.includes(c.id) && (new Date(c.startTime).getTime() + c.duration*60*1000) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (watched.length === 0) {
      container.innerHTML = `<div class="empty-state">Your watchlist is currently empty. Star some upcoming contests in the Contest Hub to start tracking them! 🌟</div>`;
      return;
    }

    container.innerHTML = watched.slice(0, 3).map(c => `
      <div class="watchlist-item">
        <div class="watchlist-item-info">
          <h4>${c.name}</h4>
          <div class="watchlist-item-meta">
            <span class="platform-badge ${c.platform}">${c.platform.toUpperCase()}</span>
            <span>${this.formatDate(c.startTime)}</span>
          </div>
        </div>
        <a href="${c.url}" target="_blank" class="btn btn-secondary btn-sm" aria-label="Register Link">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      </div>
    `).join('');
  },

  // 6. Render Goals lists
  renderGoals(goals) {
    const dashContainer = document.getElementById('dashboard-goals-container');
    const pageContainer = document.getElementById('goals-page-list');
    const goalsEmptyState = document.getElementById('goals-empty-state');

    // 6a. Render on Dashboard
    if (dashContainer) {
      if (goals.length === 0) {
        dashContainer.innerHTML = `<div class="empty-state">No goals set yet. Set a target like 'Solve 20 DP questions' to track your progress and push your limits! 🎯</div>`;
      } else {
        dashContainer.innerHTML = goals.slice(0, 3).map(g => {
          const percent = Math.min(100, Math.round((g.current / g.target) * 100));
          return `
            <div class="goal-item">
              <div class="goal-item-header">
                <span class="goal-item-title">${g.title}</span>
                <span class="goal-item-deadline">By ${g.deadline}</span>
              </div>
              <div class="goal-progress-container">
                <div class="goal-progress-bar">
                  <div class="goal-progress-fill" style="width: ${percent}%"></div>
                </div>
                <span class="goal-progress-text">${g.current}/${g.target}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 6b. Render on Goal Center Page
    if (pageContainer) {
      if (goals.length === 0) {
        pageContainer.innerHTML = '';
        if (goalsEmptyState) goalsEmptyState.style.display = 'flex';
      } else {
        if (goalsEmptyState) goalsEmptyState.style.display = 'none';
        pageContainer.innerHTML = goals.map(g => {
          const percent = Math.min(100, Math.round((g.current / g.target) * 100));
          return `
            <div class="goal-card">
              <div class="goal-card-header">
                <span class="goal-card-type-badge">${g.type.toUpperCase()}</span>
                <button class="goal-card-delete-btn" data-goal-id="${g.id}" aria-label="Delete Goal">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
              <h4 class="goal-card-title">${g.title}</h4>
              <div class="goal-card-progress-wrapper">
                <div class="goal-card-progress-info">
                  <span>Progress</span>
                  <span class="goal-progress-text">${percent}% (${g.current}/${g.target})</span>
                </div>
                <div class="goal-card-progress-bar">
                  <div class="goal-card-progress-fill" style="width: ${percent}%"></div>
                </div>
              </div>
              <div class="goal-card-footer">
                <span>Deadline: ${g.deadline}</span>
                <span style="color: ${g.completed ? 'var(--color-accent-emerald)' : 'var(--color-text-muted)'}">
                  ${g.completed ? '🎉 Completed' : '💪 In Progress'}
                </span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  // 7. Render Contest Hub Grid
  renderContests(contests, watchlistIds, statusTab, platformFilter, searchQuery, sortVal) {
    const container = document.getElementById('contests-container');
    if (!container) return;

    clearAllIntervals(); // Clear timers first

    const now = Date.now();

    // Filter by Platform, Status, Search
    let filtered = contests.filter(c => {
      // Platform filter
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;

      // Status Filter (Upcoming, Active, Finished)
      const startTime = new Date(c.startTime).getTime();
      const endTime = startTime + c.duration * 60 * 1000;
      
      if (statusTab === 'upcoming' && startTime <= now) return false;
      if (statusTab === 'active' && (startTime > now || endTime < now)) return false;
      if (statusTab === 'finished' && endTime >= now) return false;

      // Search Query
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      
      if (sortVal === 'time-asc') return aTime - bTime;
      if (sortVal === 'time-desc') return bTime - aTime;
      if (sortVal === 'duration-asc') return a.duration - b.duration;
      if (sortVal === 'duration-desc') return b.duration - a.duration;
      return 0;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: span 3;">
          <h4>No Contests Found</h4>
          <p>Try modifying your filters or search keywords.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(c => {
      const isStarred = watchlistIds.includes(c.id);
      const startTime = new Date(c.startTime).getTime();
      const endTime = startTime + c.duration * 60 * 1000;
      
      // Determine countdown values
      let timerClass = '';
      let timerLabel = '';
      let actionButtons = '';
      
      if (startTime > now) {
        // Upcoming Contest
        timerLabel = 'Starts in: --:--:--';
        actionButtons = `
          <div class="calendar-dropdown-container">
            <button class="btn btn-secondary calendar-trigger" data-contest-id="${c.id}">
              Add To Calendar
            </button>
            <div class="calendar-menu" id="cal-menu-${c.id}">
              <button class="calendar-menu-item google-add" data-contest-id="${c.id}">Google Calendar</button>
              <button class="calendar-menu-item ics-download" data-contest-id="${c.id}">Download .ICS</button>
            </div>
          </div>
          <a href="${c.url}" target="_blank" class="btn btn-primary">Register</a>
        `;
      } else if (startTime <= now && endTime > now) {
        // Active Contest
        timerClass = 'active';
        timerLabel = 'Ends in: --:--:--';
        actionButtons = `<a href="${c.url}" target="_blank" class="btn btn-danger">Enter Arena</a>`;
      } else {
        // Finished Contest
        timerLabel = 'Ended';
        
        // Check if performance is already logged
        const log = Storage.getPerformanceLogs().find(l => l.contestId === c.id);
        if (log) {
          if (log.status === 'missed') {
            actionButtons = `<button class="btn btn-secondary btn-sm" style="color: var(--color-accent-rose); border-color: rgba(244, 63, 94, 0.2); background: rgba(244, 63, 94, 0.05); width: 100%; justify-content: center;" disabled>Missed ✗</button>`;
          } else {
            actionButtons = `<button class="btn btn-secondary btn-sm" style="color: var(--color-accent-emerald); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); width: 100%; justify-content: center;" disabled>Attended ✓</button>`;
          }
        } else {
          actionButtons = `
            <button class="btn btn-primary btn-sm log-performance-trigger" data-contest-id="${c.id}" data-contest-platform="${c.platform}" data-contest-title="${c.name}" style="flex-grow: 1;">Attended</button>
            <button class="btn btn-secondary btn-sm mark-missed-trigger" data-contest-id="${c.id}" data-contest-platform="${c.platform}" data-contest-title="${c.name}" style="flex-grow: 1;">Missed</button>
          `;
        }
      }

      return `
        <div class="contest-card ${c.platform}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <span class="platform-badge ${c.platform}">${c.platform.toUpperCase()}</span>
            <button class="star-btn ${isStarred ? 'active' : ''}" data-contest-id="${c.id}" aria-label="Watch Contest">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
          
          <h3 class="contest-title-heading">${c.name}</h3>
          
          <div class="contest-details-row">
            <div class="detail-item">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${this.formatDate(c.startTime)}</span>
            </div>
            <div class="detail-item">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${this.formatDuration(c.duration)}</span>
            </div>
          </div>
          
          <div class="contest-card-timer ${timerClass}" id="timer-${c.id}">
            ${timerLabel}
          </div>
          
          <div class="contest-actions">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    // Setup active ticking countdown timers on each card
    filtered.forEach(c => {
      const startTime = new Date(c.startTime).getTime();
      const endTime = startTime + c.duration * 60 * 1000;
      
      if (endTime <= now) return; // already ended, no timer

      const targetTime = startTime > now ? startTime : endTime;
      const labelPrefix = startTime > now ? '' : 'Ends in: ';
      const timerElement = document.getElementById(`timer-${c.id}`);

      const tick = () => {
        const msLeft = targetTime - Date.now();
        if (msLeft <= 0) {
          if (timerElement) timerElement.textContent = startTime > now ? 'Active!' : 'Ended';
          // Refresh list triggers page update
          return;
        }

        const hrs = Math.floor(msLeft / (60 * 60 * 1000));
        const mins = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
        const secs = Math.floor((msLeft % (60 * 1000)) / 1000);

        const hStr = hrs.toString().padStart(2, '0');
        const mStr = mins.toString().padStart(2, '0');
        const sStr = secs.toString().padStart(2, '0');

        if (timerElement) {
          timerElement.textContent = `${labelPrefix}${hStr}:${mStr}:${sStr}`;
        }
      };

      tick();
      const interval = setInterval(tick, 1000);
      activeIntervals.push(interval);
    });
  },

  // 8. Render LeetCode POTD Widget on Dashboard with Streak tracking
  renderPOTDWidget(potd, isSolved) {
    const title = document.getElementById('potd-title');
    const difficulty = document.getElementById('potd-difficulty');
    const tags = document.getElementById('potd-tags');
    const solveLink = document.getElementById('potd-solve-link');
    const checkbox = document.getElementById('potd-solved-checkbox');
    const badge = document.getElementById('potd-badge-id');

    if (!title) return;

    title.textContent = potd.title;
    difficulty.textContent = potd.difficulty;
    difficulty.className = `difficulty-tag ${potd.difficulty.toLowerCase()}`;
    solveLink.href = potd.link;
    checkbox.checked = isSolved;

    // Load Tags
    if (potd.topicTags && potd.topicTags.length > 0) {
      tags.innerHTML = potd.topicTags.slice(0, 3).map(tag => `
        <span class="topic-pill">${tag.name}</span>
      `).join('');
    } else {
      tags.innerHTML = '<span class="topic-pill">Daily Challenge</span>';
    }

    // Calculate POTD Streak from Storage
    try {
      const problems = Storage.getProblems();
      const potdSolved = problems.filter(p => p.sheetName === 'LEETCODE POTD' && p.status === 'solved');
      
      if (potdSolved.length > 0) {
        const solvedDates = new Set(
          potdSolved.map(p => {
            const d = new Date(p.dateAdded);
            return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
          })
        );

        const getLocalDateStr = (d) => {
          return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        };

        const todayStr = getLocalDateStr(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateStr(yesterday);

        let currentStreak = 0;
        let checkDate = new Date();

        if (solvedDates.has(todayStr)) {
          currentStreak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (solvedDates.has(yesterdayStr)) {
          currentStreak = 1;
          checkDate.setDate(checkDate.getDate() - 2);
        }

        if (currentStreak > 0) {
          while (true) {
            const dateStr = getLocalDateStr(checkDate);
            if (solvedDates.has(dateStr)) {
              currentStreak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        if (badge) {
          badge.innerHTML = `LeetCode POTD ${currentStreak > 0 ? `| 🔥 ${currentStreak} Day Streak` : ''}`;
        }
      } else {
        if (badge) badge.textContent = 'LeetCode POTD';
      }
    } catch (e) {
      console.warn("Failed to calculate POTD streak", e);
    }
  },

  // 9. Render Problem Notebook Table
  renderProblemsTable(problems, searchVal, statusFilter, topicFilter, difficultyFilter, sheetFilter) {
    const tbody = document.getElementById('problems-tbody');
    const emptyState = document.getElementById('problems-empty-state');
    if (!tbody) return;

    // Populate filter selectors options dynamically from current problems
    const topicSelector = document.getElementById('problem-filter-topic');
    const sheetSelector = document.getElementById('problem-filter-sheet');
    
    if (topicSelector && topicSelector.options.length <= 1) {
      const uniqueTopics = new Set();
      problems.forEach(p => p.topic && p.topic.split(',').forEach(t => uniqueTopics.add(t.trim())));
      uniqueTopics.forEach(topic => {
        if (topic) {
          const opt = document.createElement('option');
          opt.value = topic.toLowerCase();
          opt.textContent = topic;
          topicSelector.appendChild(opt);
        }
      });
    }

    if (sheetSelector && sheetSelector.options.length <= 2) {
      const uniqueSheets = new Set();
      problems.forEach(p => p.sheetName && uniqueSheets.add(p.sheetName));
      uniqueSheets.forEach(sheet => {
        if (sheet && sheet !== 'Custom') {
          const opt = document.createElement('option');
          opt.value = sheet.toLowerCase();
          opt.textContent = sheet;
          sheetSelector.appendChild(opt);
        }
      });
    }

    // Filter problems
    const filtered = problems.filter(p => {
      // Search term
      if (searchVal) {
        const query = searchVal.toLowerCase();
        const inTitle = p.title.toLowerCase().includes(query);
        const inTopic = p.topic && p.topic.toLowerCase().includes(query);
        const inSheet = p.sheetName && p.sheetName.toLowerCase().includes(query);
        if (!inTitle && !inTopic && !inSheet) return false;
      }

      // Status
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // Topic
      if (topicFilter !== 'all') {
        if (!p.topic || !p.topic.toLowerCase().includes(topicFilter)) return false;
      }

      // Difficulty
      if (difficultyFilter !== 'all' && p.difficulty.toLowerCase() !== difficultyFilter) return false;

      // Sheet
      if (sheetFilter !== 'all') {
        if (sheetFilter === 'custom' && p.sheetName !== 'Custom') return false;
        if (sheetFilter !== 'custom' && p.sheetName.toLowerCase() !== sheetFilter) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(p => `
      <tr class="problem-row" data-problem-id="${p.id}">
        <td>
          <span class="problem-status-icon ${p.status}">
            ${p.status === 'solved' ? '✓' : p.status === 'inprogress' ? '⋯' : p.status === 'review' ? '!' : '○'}
          </span>
        </td>
        <td>
          <div class="problem-row-title">
            <span>${p.title}</span>
            ${p.sheetName && p.sheetName !== 'Custom' ? `<span class="problem-row-sheet-label">${p.sheetName}</span>` : ''}
          </div>
        </td>
        <td><span class="platform-badge ${p.platform}">${p.platform.toUpperCase()}</span></td>
        <td><span class="difficulty-tag ${p.difficulty.toLowerCase()}">${p.difficulty}</span></td>
      </tr>
    `).join('');
  },

  // 10. Open Problem Editor details on the right panel
  openProblemEditor(problem) {
    const container = document.getElementById('problem-editor-container');
    if (!container) return;

    if (!problem) {
      container.innerHTML = `
        <div class="editor-placeholder">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><path d="M12 9V5"/></svg>
          <h4>Select a problem to view and edit notes</h4>
          <p>Solve DSA questions, write key logical take-aways and store optimized code snippets here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="active-editor">
        <div class="editor-header">
          <div class="editor-title-container">
            <h3>${problem.title}</h3>
            <div class="editor-meta-tags">
              <span class="platform-badge ${problem.platform}">${problem.platform.toUpperCase()}</span>
              <span class="difficulty-tag ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
              ${problem.topic ? problem.topic.split(',').map(tag => `<span class="topic-pill">${tag.trim()}</span>`).join('') : ''}
            </div>
          </div>
          <div class="editor-actions" style="display: flex; gap: 8px;">
            ${problem.url ? `
              <a href="${problem.url}" target="_blank" class="btn btn-secondary btn-sm" title="Open Link">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            ` : ''}
            <button class="btn btn-danger btn-sm editor-delete-btn" data-problem-id="${problem.id}" title="Delete Problem">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="editor-body">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label for="editor-status-select" style="font-size: 0.85rem; font-weight: 500; color: var(--color-text-secondary);">Status</label>
            <select id="editor-status-select" class="select-input select-sm" data-problem-id="${problem.id}">
              <option value="todo" ${problem.status === 'todo' ? 'selected' : ''}>To Do</option>
              <option value="inprogress" ${problem.status === 'inprogress' ? 'selected' : ''}>In Progress</option>
              <option value="solved" ${problem.status === 'solved' ? 'selected' : ''}>Solved</option>
              <option value="review" ${problem.status === 'review' ? 'selected' : ''}>Needs Review</option>
            </select>
          </div>
          
          <label style="font-size: 0.85rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: -10px;">Problem Notes (Markdown Supported)</label>
          <textarea class="notes-textarea" id="editor-notes-content" placeholder="Write down optimal approaches, complexity analysis, helper code snippets...">${problem.notes || ''}</textarea>
        </div>

        <div class="editor-footer">
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Added: ${new Date(problem.dateAdded).toLocaleDateString()}</span>
          <button class="btn btn-primary btn-sm" id="editor-save-notes-btn" data-problem-id="${problem.id}">Save Notes</button>
        </div>
      </div>
    `;
  },

  // 11. Render Performance Logs in Analytics Page
  renderPerformanceLogs(logs) {
    const tbody = document.getElementById('performance-logs-tbody');
    const emptyState = document.getElementById('logs-empty-state');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Sort by date descending
    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sortedLogs.map(l => {
      let ratingChangeHtml = '<span class="rating-neutral">--</span>';
      if (l.ratingChange !== null) {
        if (l.ratingChange > 0) ratingChangeHtml = `<span class="rating-up">+${l.ratingChange}</span>`;
        else if (l.ratingChange < 0) ratingChangeHtml = `<span class="rating-down">${l.ratingChange}</span>`;
        else ratingChangeHtml = `<span class="rating-neutral">0</span>`;
      }

      return `
        <tr>
          <td>${new Date(l.date).toLocaleDateString()}</td>
          <td style="font-weight: 600;">${l.contestName}</td>
          <td><span class="platform-badge ${l.platform}">${l.platform.toUpperCase()}</span></td>
          <td style="font-family: var(--font-mono); font-weight: 600;">#${l.rank}</td>
          <td>${l.solved}/${l.total}</td>
          <td>${ratingChangeHtml}</td>
          <td>
            <button class="btn btn-secondary btn-sm delete-log-btn" data-log-id="${l.id}" aria-label="Delete Log">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
};
