// Main Bootstrapper, App State Controller, Routing, and Event Bindings

import { Storage } from './storage.js';
import { API } from './api.js';
import { UI } from './ui.js';
import { Calendar } from './calendar.js';
import { Notifications } from './notifications.js';
import { Charts } from './charts.js';
import { DSA_SHEETS } from './sheets.js';

// Application State
const STATE = {
  contests: [],
  watchlistIds: [],
  problems: [],
  performanceLogs: [],
  goals: [],
  settings: {},
  activePage: 'dashboard',
  selectedProblem: null,
  leetcodePOTD: null,
  cfRatingHistory: [],
  cfUserDetail: null,
  leetcodeRatingHistory: [],
  leetcodeUserDetail: null,
  cfSubmissionsDetail: null,
  codechefUserDetail: null,
  atcoderUserDetail: null,
  atcoderRatingHistory: []
};

// Initialize the Application
async function init() {
  console.log("👋 Welcome to Apex Contest Tracker! Booting up your dashboard and syncing stats...");
  
  // 0. Sync data with the backend database
  try {
    const response = await fetch('/api/user');
    const serverData = await response.json();
    
    const hasLocal = localStorage.getItem('apex_settings') !== null;
    const isServerEmpty = !serverData.settings || (!serverData.settings.cfHandle && !serverData.settings.leetcodeHandle);

    if (isServerEmpty && hasLocal) {
      // Migrate local storage to server
      const localState = {
        settings: Storage.getSettings(),
        problems: Storage.getProblems(),
        watchlist: Storage.getWatchlist(),
        performanceLogs: Storage.getPerformanceLogs(),
        goals: Storage.getGoals(),
        customContests: Storage.getCustomContests()
      };
      
      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localState)
      });
      console.log("Local browser progress successfully migrated to the backend database.");
    } else if (serverData.settings && (serverData.settings.cfHandle || serverData.settings.leetcodeHandle || serverData.settings.codechefHandle || serverData.settings.atcoderHandle)) {
      // Load server state to browser local storage cache
      localStorage.setItem('apex_settings', JSON.stringify(serverData.settings));
      if (serverData.problems) localStorage.setItem('apex_problems', JSON.stringify(serverData.problems));
      if (serverData.watchlist) localStorage.setItem('apex_watchlist', JSON.stringify(serverData.watchlist));
      if (serverData.performanceLogs) localStorage.setItem('apex_performance_logs', JSON.stringify(serverData.performanceLogs));
      if (serverData.goals) localStorage.setItem('apex_goals', JSON.stringify(serverData.goals));
      if (serverData.customContests) localStorage.setItem('apex_custom_contests', JSON.stringify(serverData.customContests));
      console.log("Browser local cache successfully synchronized with server database.");
    }
  } catch (e) {
    console.warn("Backend database offline. App running in offline LocalStorage mode.", e);
  }

  // 1. Load LocalStorage State
  STATE.settings = Storage.getSettings();
  STATE.watchlistIds = Storage.getWatchlist();
  STATE.problems = Storage.getProblems();
  STATE.performanceLogs = Storage.getPerformanceLogs();
  STATE.goals = Storage.getGoals();

  // 2. Fetch User Details on Codeforces (if handle is set)
  if (STATE.settings.cfHandle) {
    try {
      const user = await API.fetchCodeforcesUser(STATE.settings.cfHandle);
      if (user) {
        STATE.cfUserDetail = user;
        STATE.settings.cfRating = user.rating; // Sync rating locally
        Storage.saveSettings({ cfRating: user.rating });
      }
      
      // Load history
      STATE.cfRatingHistory = await API.fetchCodeforcesRatingHistory(STATE.settings.cfHandle);
      // Load submissions stats
      STATE.cfSubmissionsDetail = await API.fetchCodeforcesSubmissions(STATE.settings.cfHandle);
    } catch (e) {
      console.warn("Could not fetch initial Codeforces user profile detail", e);
    }
  }

  // 2b. Fetch User Details on LeetCode (if handle is set)
  if (STATE.settings.leetcodeHandle) {
    try {
      const user = await API.fetchLeetCodeUser(STATE.settings.leetcodeHandle);
      if (user) {
        STATE.leetcodeUserDetail = user;
      }
      // Load history
      STATE.leetcodeRatingHistory = await API.fetchLeetCodeRatingHistory(STATE.settings.leetcodeHandle);
    } catch (e) {
      console.warn("Could not fetch initial LeetCode user profile detail", e);
    }
  }

  // 2c. Fetch User Details on CodeChef (if handle is set)
  if (STATE.settings.codechefHandle) {
    try {
      const user = await API.fetchCodeChefUser(STATE.settings.codechefHandle);
      if (user) {
        STATE.codechefUserDetail = user;
        STATE.settings.codechefRating = user.rating; // sync locally
        Storage.saveSettings({ codechefRating: user.rating });
      }
    } catch (e) {
      console.warn("Could not fetch initial CodeChef user profile detail", e);
    }
  }

  // 2d. Fetch User Details on AtCoder (if handle is set)
  if (STATE.settings.atcoderHandle) {
    try {
      const user = await API.fetchAtCoderUser(STATE.settings.atcoderHandle);
      if (user) {
        STATE.atcoderUserDetail = user;
        STATE.settings.atcoderRating = user.rating; // sync locally
        Storage.saveSettings({ atcoderRating: user.rating });
      }
      // Load history
      STATE.atcoderRatingHistory = await API.fetchAtCoderRatingHistory(STATE.settings.atcoderHandle);
    } catch (e) {
      console.warn("Could not fetch initial AtCoder user profile detail", e);
    }
  }

  // 3. Draw initial static UI
  UI.updateSidebarProfile(STATE.settings);
  UI.renderGoals(STATE.goals);
  UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
  UI.openProblemEditor(null);
  UI.renderPerformanceLogs(STATE.performanceLogs);

  // 4. Set up Event Listeners
  setupNavigation();
  setupModals();
  setupInteractiveActions();
  setupFormSubmissions();

  // 5. Fetch Async Data (POTD and Contests list)
  loadAsyncData();

  // 6. Request Notification Permissions
  if (STATE.settings.notify) {
    Notifications.requestPermission();
  }

  // 7. Setup Background Alarms Loop (runs every 60s)
  setInterval(() => {
    Notifications.checkContestAlarms(STATE.contests, STATE.watchlistIds, STATE.settings);
  }, 60000);
}

// Client-side Tab Navigation routing
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const pages = document.querySelectorAll('.page-section');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      
      // Update sidebar visual classes
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update pages visual classes
      pages.forEach(p => p.classList.remove('active'));
      const activePage = document.getElementById(`page-${target}`);
      if (activePage) {
        activePage.classList.add('active');
        STATE.activePage = target;
        onPageChange(target);
      }
    });
  });
}

// Hook running when page tabs toggle
function onPageChange(pageId) {
  if (pageId === 'dashboard') {
    UI.updateNextUpBanner(STATE.contests, STATE.watchlistIds);
    UI.renderDashboardWatchlist(STATE.contests, STATE.watchlistIds);
    UI.renderGoals(STATE.goals);
  } else if (pageId === 'contests') {
    const statusTab = document.querySelector('.tabs-btn-group .tab-btn.active').getAttribute('data-status');
    const platformFilter = document.querySelector('.platform-filters .filter-pill.active').getAttribute('data-platform');
    const searchVal = document.getElementById('contest-search').value;
    const sortVal = document.getElementById('contest-sort').value;
    
    UI.renderContests(STATE.contests, STATE.watchlistIds, statusTab, platformFilter, searchVal, sortVal);
  } else if (pageId === 'problems') {
    STATE.problems = Storage.getProblems();
    UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
  } else if (pageId === 'analytics') {
    STATE.performanceLogs = Storage.getPerformanceLogs();
    STATE.problems = Storage.getProblems();
    
    UI.renderPerformanceLogs(STATE.performanceLogs);
    
    const chartPlatform = document.getElementById('rating-chart-platform').value;
    Charts.updateRatingChart(chartPlatform, STATE.cfRatingHistory, STATE.leetcodeRatingHistory, STATE.atcoderRatingHistory, STATE.performanceLogs, STATE.settings);
    Charts.updateTopicSolveChart(STATE.problems, STATE.cfSubmissionsDetail);
    Charts.updateDailyActivityChart(STATE.problems, STATE.cfSubmissionsDetail);
    Charts.calculateWeakTopics(STATE.problems, STATE.performanceLogs);
  } else if (pageId === 'goals') {
    STATE.goals = Storage.getGoals();
    UI.renderGoals(STATE.goals);
  }
}

// Set up open/close triggers for Modals
function setupModals() {
  const modalConfigs = [
    { trigger: 'open-settings-btn', modal: 'modal-settings' },
    { trigger: 'dashboard-new-contest-btn', modal: 'modal-custom-contest' },
    { trigger: 'add-problem-btn', modal: 'modal-add-problem' },
    { trigger: 'import-dsa-sheet-btn', modal: 'modal-import-sheet' },
    { trigger: 'dashboard-add-goal', modal: 'modal-add-goal' },
    { trigger: 'goal-center-add-btn', modal: 'modal-add-goal' }
  ];

  modalConfigs.forEach(cfg => {
    const btn = document.getElementById(cfg.trigger);
    const modal = document.getElementById(cfg.modal);
    if (btn && modal) {
      btn.addEventListener('click', () => {
        // Pre-fill inputs on opening settings modal
        if (cfg.modal === 'modal-settings') {
          document.getElementById('settings-cf-handle').value = STATE.settings.cfHandle || '';
          document.getElementById('settings-leetcode-handle').value = STATE.settings.leetcodeHandle || '';
          document.getElementById('settings-codechef-handle').value = STATE.settings.codechefHandle || '';
          document.getElementById('settings-atcoder-handle').value = STATE.settings.atcoderHandle || '';
          document.getElementById('settings-leetcode-rating').value = STATE.settings.leetcodeRating;
          document.getElementById('settings-codechef-rating').value = STATE.settings.codechefRating;
          document.getElementById('settings-atcoder-rating').value = STATE.settings.atcoderRating;
          document.getElementById('settings-notifications-enable').checked = STATE.settings.notify;
          document.getElementById('settings-sound-enable').checked = STATE.settings.sound;
        }
        modal.classList.add('active');
      });
    }
  });

  // Wire close actions
  const closeBtns = document.querySelectorAll('.close-modal-btn, .cancel-modal-btn');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });
}

// Bind clicks on list elements, buttons, and status toggles
function setupInteractiveActions() {
  // 1. Contest Stars & Calendar clicks
  const contestsHub = document.getElementById('contests-container');
  if (contestsHub) {
    contestsHub.addEventListener('click', (e) => {
      // star rating
      const star = e.target.closest('.star-btn');
      if (star) {
        const id = star.getAttribute('data-contest-id');
        const added = Storage.toggleWatchlist(id);
        STATE.watchlistIds = Storage.getWatchlist();
        star.classList.toggle('active');
        
        Notifications.createUIToast(
          added ? 'Added to Watchlist' : 'Removed from Watchlist',
          `Successfully updated contest alerts.`,
          added ? 'success' : 'info'
        );
        return;
      }

      // Calendar Dropdown toggles
      const calTrigger = e.target.closest('.calendar-trigger');
      if (calTrigger) {
        const id = calTrigger.getAttribute('data-contest-id');
        const menu = document.getElementById(`cal-menu-${id}`);
        if (menu) menu.classList.toggle('show');
        return;
      }

      // Google Calendar Redirection
      const googleBtn = e.target.closest('.google-add');
      if (googleBtn) {
        const id = googleBtn.getAttribute('data-contest-id');
        const contest = STATE.contests.find(c => c.id === id);
        if (contest) {
          window.open(Calendar.getGoogleCalendarUrl(contest), '_blank');
        }
        return;
      }

      // ICS file download
      const icsBtn = e.target.closest('.ics-download');
      if (icsBtn) {
        const id = icsBtn.getAttribute('data-contest-id');
        const contest = STATE.contests.find(c => c.id === id);
        if (contest) {
          Calendar.downloadICS(contest);
        }
        return;
      }

      // Log Performance modal opener
      const logTrigger = e.target.closest('.log-performance-trigger');
      if (logTrigger) {
        const id = logTrigger.getAttribute('data-contest-id');
        const title = logTrigger.getAttribute('data-contest-title');
        const platform = logTrigger.getAttribute('data-contest-platform');
        
        document.getElementById('log-contest-id').value = id;
        document.getElementById('log-contest-platform').value = platform;
        document.getElementById('log-contest-title').textContent = title;
        
        document.getElementById('modal-log-performance').classList.add('active');
      }

      // Mark Missed trigger
      const missedTrigger = e.target.closest('.mark-missed-trigger');
      if (missedTrigger) {
        const id = missedTrigger.getAttribute('data-contest-id');
        const title = missedTrigger.getAttribute('data-contest-title');
        const platform = missedTrigger.getAttribute('data-contest-platform');
        
        Storage.addPerformanceLog({
          contestId: id,
          contestName: title,
          platform: platform,
          status: 'missed',
          rank: '',
          ratingChange: '',
          solved: '',
          total: ''
        });
        
        STATE.performanceLogs = Storage.getPerformanceLogs();
        updateDashboardQuickStats();
        
        // Refresh page views
        onPageChange(STATE.activePage);
        
        Notifications.createUIToast('Contest Missed', `Contest "${title}" marked as missed.`, 'info');
      }
    });

    // Close calendars dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.calendar-dropdown-container')) {
        document.querySelectorAll('.calendar-menu').forEach(m => m.classList.remove('show'));
      }
    });
  }

  // 2. Click a Problem row to edit notes
  const problemsTable = document.getElementById('problems-tbody');
  if (problemsTable) {
    problemsTable.addEventListener('click', (e) => {
      const row = e.target.closest('.problem-row');
      if (row) {
        // Toggle row highlight styles
        document.querySelectorAll('.problem-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');

        const id = row.getAttribute('data-problem-id');
        STATE.selectedProblem = STATE.problems.find(p => p.id === id);
        UI.openProblemEditor(STATE.selectedProblem);
      }
    });
  }

  // 3. Problem Notebook details actions
  const editorContainer = document.getElementById('problem-editor-container');
  if (editorContainer) {
    // Save Notes Button
    editorContainer.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('#editor-save-notes-btn');
      if (saveBtn) {
        const id = saveBtn.getAttribute('data-problem-id');
        const notes = document.getElementById('editor-notes-content').value;
        Storage.updateProblemNotes(id, notes);
        STATE.problems = Storage.getProblems();
        
        Notifications.createUIToast('Notes Saved', 'Problem Notebook entries successfully updated.', 'success');
        return;
      }

      // Delete Problem Button
      const deleteBtn = e.target.closest('.editor-delete-btn');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-problem-id');
        Storage.deleteProblem(id);
        STATE.problems = Storage.getProblems();
        UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
        UI.openProblemEditor(null);
        
        Notifications.createUIToast('Problem Deleted', 'Successfully removed from Notebook.', 'info');
        return;
      }
    });

    // Status dropdown change
    editorContainer.addEventListener('change', (e) => {
      const statusSelect = e.target.closest('#editor-status-select');
      if (statusSelect) {
        const id = statusSelect.getAttribute('data-problem-id');
        const status = statusSelect.value;
        Storage.updateProblemStatus(id, status);
        
        // Refresh local memory and table
        STATE.problems = Storage.getProblems();
        UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
        
        // Keep row highlight active
        const activeRow = document.querySelector(`.problem-row[data-problem-id="${id}"]`);
        if (activeRow) activeRow.classList.add('active');

        // Check if POTD solved state needs matching
        if (STATE.leetcodePOTD && STATE.selectedProblem && STATE.selectedProblem.title === STATE.leetcodePOTD.title) {
          document.getElementById('potd-solved-checkbox').checked = (status === 'solved');
        }
      }
    });
  }

  // 4. DSA Sheet Import Modal action buttons
  const dsaModal = document.getElementById('modal-import-sheet');
  if (dsaModal) {
    dsaModal.addEventListener('click', (e) => {
      const action = e.target.closest('.import-sheet-action');
      if (action) {
        const sheetKey = action.getAttribute('data-sheet');
        const sheetQuestions = DSA_SHEETS[sheetKey];
        if (sheetQuestions) {
          const imported = Storage.importDSASheet(sheetKey.toUpperCase(), sheetQuestions);
          STATE.problems = Storage.getProblems();
          UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
          dsaModal.classList.remove('active');

          Notifications.createUIToast(
            'Import Successful!',
            `Imported ${imported} new questions from DSA Sheet.`,
            'success'
          );
        }
      }
    });
  }

  // 5. LeetCode POTDSolved Checkbox click
  const potdCheckbox = document.getElementById('potd-solved-checkbox');
  if (potdCheckbox) {
    potdCheckbox.addEventListener('change', () => {
      if (!STATE.leetcodePOTD) return;
      
      const isChecked = potdCheckbox.checked;
      if (isChecked) {
        // Add to Notebook
        const newProb = Storage.addProblem({
          title: STATE.leetcodePOTD.title,
          url: STATE.leetcodePOTD.link,
          platform: 'leetcode',
          difficulty: STATE.leetcodePOTD.difficulty,
          topic: STATE.leetcodePOTD.topicTags.map(t => t.name).join(', '),
          status: 'solved',
          sheetName: 'LEETCODE POTD'
        });
        STATE.problems = Storage.getProblems();
        UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
        
        Notifications.createUIToast(
          'POTD Completed! 🎉',
          `Added "${STATE.leetcodePOTD.title}" to your Problem Notebook.`,
          'success'
        );
      } else {
        // Remove from Notebook or toggle state
        const exists = STATE.problems.find(p => p.title === STATE.leetcodePOTD.title && p.sheetName === 'LEETCODE POTD');
        if (exists) {
          Storage.deleteProblem(exists.id);
          STATE.problems = Storage.getProblems();
          UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');
          
          Notifications.createUIToast(
            'POTD Unmarked',
            'Removed POTD entry from your Notebook.',
            'info'
          );
        }
      }
    });
  }

  // 6. Delete Goals click handlers
  const goalsPage = document.getElementById('goals-page-list');
  if (goalsPage) {
    goalsPage.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.goal-card-delete-btn');
      if (delBtn) {
        const id = delBtn.getAttribute('data-goal-id');
        Storage.deleteGoal(id);
        STATE.goals = Storage.getGoals();
        UI.renderGoals(STATE.goals);
        
        Notifications.createUIToast('Goal Deleted', 'Target removed successfully.', 'info');
      }
    });
  }

  // 7. Delete Performance Logs click
  const logsTable = document.getElementById('performance-logs-tbody');
  if (logsTable) {
    logsTable.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.delete-log-btn');
      if (delBtn) {
        const id = delBtn.getAttribute('data-log-id');
        Storage.deletePerformanceLog(id);
        STATE.performanceLogs = Storage.getPerformanceLogs();
        UI.renderPerformanceLogs(STATE.performanceLogs);
        
        Notifications.createUIToast('Log Deleted', 'Contest log removed.', 'info');
      }
    });
  }

  // 8. Filters for Contest Hub page
  const searchInput = document.getElementById('contest-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => onPageChange('contests'));
  }
  
  const platformFilters = document.getElementById('platform-filters-container');
  if (platformFilters) {
    platformFilters.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (pill) {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        onPageChange('contests');
      }
    });
  }

  const tabButtonsGroup = document.querySelector('.tabs-btn-group');
  if (tabButtonsGroup) {
    tabButtonsGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onPageChange('contests');
      }
    });
  }

  const contestSort = document.getElementById('contest-sort');
  if (contestSort) {
    contestSort.addEventListener('change', () => onPageChange('contests'));
  }

  // 9. Filters for Problem Notebook
  const probSearch = document.getElementById('problem-search');
  if (probSearch) {
    probSearch.addEventListener('input', () => filterNotebookProblems());
  }
  const probStatus = document.getElementById('problem-filter-status');
  if (probStatus) {
    probStatus.addEventListener('change', () => filterNotebookProblems());
  }
  const probTopic = document.getElementById('problem-filter-topic');
  if (probTopic) {
    probTopic.addEventListener('change', () => filterNotebookProblems());
  }
  const probDiff = document.getElementById('problem-filter-difficulty');
  if (probDiff) {
    probDiff.addEventListener('change', () => filterNotebookProblems());
  }
  const probSheet = document.getElementById('problem-filter-sheet');
  if (probSheet) {
    probSheet.addEventListener('change', () => filterNotebookProblems());
  }

  // 10. Analytics platform chart selector
  const chartPlatform = document.getElementById('rating-chart-platform');
  if (chartPlatform) {
    chartPlatform.addEventListener('change', (e) => {
      Charts.updateRatingChart(e.target.value, STATE.cfRatingHistory, STATE.leetcodeRatingHistory, STATE.atcoderRatingHistory, STATE.performanceLogs, STATE.settings);
    });
  }

  // 11. Friend Compare handles resolver
  const compareBtn = document.getElementById('compare-handles-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
      const userHandle = document.getElementById('compare-user-handle').value.trim();
      const friendHandle = document.getElementById('compare-friend-handle').value.trim();

      if (!userHandle || !friendHandle) {
        Notifications.createUIToast('Inputs Required', 'Please enter both Codeforces handles.', 'warn');
        return;
      }

      compareBtn.disabled = true;
      compareBtn.textContent = 'Comparing...';
      
      try {
        // Fetch profiles
        const uProfile = await API.fetchCodeforcesUser(userHandle);
        const fProfile = await API.fetchCodeforcesUser(friendHandle);
        
        if (!uProfile || !fProfile) {
          throw new Error("One or both handles are invalid.");
        }

        // Fetch histories
        const uHistory = await API.fetchCodeforcesRatingHistory(userHandle);
        const fHistory = await API.fetchCodeforcesRatingHistory(friendHandle);

        // Hide placeholder and reveal dashboard
        document.getElementById('comparison-placeholder').style.display = 'none';
        document.getElementById('comparison-dashboard').style.display = 'grid';

        // Draw Compare Chart
        Charts.updateFriendComparisonChart(userHandle, uHistory, friendHandle, fHistory);

        // Update Scorecards
        updateScorecard('user', uProfile, uHistory);
        updateScorecard('friend', fProfile, fHistory);

        Notifications.createUIToast('Comparison Loaded', 'Comparison details successfully drawn.', 'success');
      } catch (err) {
        console.error(err);
        Notifications.createUIToast('Compare Error', err.message || 'Handles could not be matched.', 'alert');
      } finally {
        compareBtn.disabled = false;
        compareBtn.textContent = 'Compare Ratings';
      }
    });
  }
}

// Filter Problem notebook elements helper
function filterNotebookProblems() {
  const searchVal = document.getElementById('problem-search').value;
  const statusFilter = document.getElementById('problem-filter-status').value;
  const topicFilter = document.getElementById('problem-filter-topic').value;
  const diffFilter = document.getElementById('problem-filter-difficulty').value;
  const sheetFilter = document.getElementById('problem-filter-sheet').value;
  
  UI.renderProblemsTable(STATE.problems, searchVal, statusFilter, topicFilter, diffFilter, sheetFilter);
}

// Update Friend compare scorecard elements helper
function updateScorecard(type, profile, history) {
  const prefix = `${type}-score`;
  document.getElementById(`${prefix}-handle`).textContent = ` ${profile.handle}`;
  
  const ratingBadge = document.getElementById(`${prefix}-rating-badge`);
  ratingBadge.textContent = profile.rating || '--';
  
  // Set badge rank-specific visual styling if available
  ratingBadge.className = `rating-badge ${type === 'friend' ? 'friend' : ''} ${getRankColorClass(profile.rating)}`;

  document.getElementById(`${prefix}-rating`).textContent = profile.rating || '--';
  document.getElementById(`${prefix}-max`).textContent = profile.maxRating || '--';
  document.getElementById(`${prefix}-rank`).textContent = profile.rank || 'Unrated';
  document.getElementById(`${prefix}-contests`).textContent = history ? history.length : '0';
}

function getRankColorClass(rating) {
  if (!rating) return '';
  if (rating >= 2400) return 'grandmaster';
  if (rating >= 1900) return 'master';
  if (rating >= 1600) return 'candidate-master';
  if (rating >= 1400) return 'specialist';
  if (rating >= 1200) return 'pupil';
  return 'newbie';
}

// Handle Form Submissions
function setupFormSubmissions() {
  // 1. Settings Submit Form
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const handle = document.getElementById('settings-cf-handle').value.trim();
      const leetHandle = document.getElementById('settings-leetcode-handle').value.trim();
      const chefHandle = document.getElementById('settings-codechef-handle').value.trim();
      const atcHandle = document.getElementById('settings-atcoder-handle').value.trim();
      const leet = parseInt(document.getElementById('settings-leetcode-rating').value) || 1500;
      const chef = parseInt(document.getElementById('settings-codechef-rating').value) || 1400;
      const atc = parseInt(document.getElementById('settings-atcoder-rating').value) || 1200;
      const notify = document.getElementById('settings-notifications-enable').checked;
      const sound = document.getElementById('settings-sound-enable').checked;

      const newSettings = { 
        cfHandle: handle, 
        leetcodeHandle: leetHandle, 
        codechefHandle: chefHandle, 
        atcoderHandle: atcHandle, 
        leetcodeRating: leet, 
        codechefRating: chef, 
        atcoderRating: atc, 
        notify, 
        sound 
      };
      
      Storage.saveSettings(newSettings);
      STATE.settings = Storage.getSettings();

      // Set button to loading state
      saveSettingsBtn.disabled = true;
      saveSettingsBtn.textContent = 'Updating...';

      // Trigger profile refetch if Codeforces handle changed
      if (handle) {
        try {
          const user = await API.fetchCodeforcesUser(handle);
          if (user) {
            STATE.cfUserDetail = user;
            STATE.settings.cfRating = user.rating;
            Storage.saveSettings({ cfRating: user.rating });
          }
          // Reload CF rating history & submissions
          STATE.cfRatingHistory = await API.fetchCodeforcesRatingHistory(handle);
          STATE.cfSubmissionsDetail = await API.fetchCodeforcesSubmissions(handle);
        } catch (e) {
          console.warn("Failed to update user settings CF data", e);
        }
      } else {
        STATE.cfUserDetail = null;
        STATE.cfRatingHistory = [];
        STATE.cfSubmissionsDetail = null;
      }

      // Trigger profile refetch if LeetCode handle changed
      if (leetHandle) {
        try {
          const user = await API.fetchLeetCodeUser(leetHandle);
          if (user) {
            STATE.leetcodeUserDetail = user;
            const updatedRating = user.rating || user.totalSolved || 1500; // API rating fallback
            STATE.settings.leetcodeRating = updatedRating;
            Storage.saveSettings({ leetcodeRating: updatedRating });
          }
          // Reload LeetCode rating history
          STATE.leetcodeRatingHistory = await API.fetchLeetCodeRatingHistory(leetHandle);
        } catch (e) {
          console.warn("Failed to update user settings LeetCode data", e);
        }
      } else {
        STATE.leetcodeUserDetail = null;
        STATE.leetcodeRatingHistory = [];
      }

      // Trigger profile refetch if CodeChef handle changed
      if (chefHandle) {
        try {
          const user = await API.fetchCodeChefUser(chefHandle);
          if (user) {
            STATE.codechefUserDetail = user;
            STATE.settings.codechefRating = user.rating || 1400;
            Storage.saveSettings({ codechefRating: user.rating || 1400 });
          }
        } catch (e) {
          console.warn("Failed to update user settings CodeChef data", e);
        }
      } else {
        STATE.codechefUserDetail = null;
      }

      // Trigger profile refetch if AtCoder handle changed
      if (atcHandle) {
        try {
          const user = await API.fetchAtCoderUser(atcHandle);
          if (user) {
            STATE.atcoderUserDetail = user;
            STATE.settings.atcoderRating = user.rating || 1200;
            Storage.saveSettings({ atcoderRating: user.rating || 1200 });
          }
          STATE.atcoderRatingHistory = await API.fetchAtCoderRatingHistory(atcHandle);
        } catch (e) {
          console.warn("Failed to update user settings AtCoder data", e);
        }
      } else {
        STATE.atcoderUserDetail = null;
        STATE.atcoderRatingHistory = [];
      }

      UI.updateSidebarProfile(STATE.settings);
      updateDashboardQuickStats();
      
      // Close Settings Modal
      document.getElementById('modal-settings').classList.remove('active');
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = 'Save Changes';
      
      // Refresh current page views
      onPageChange(STATE.activePage);
      
      Notifications.createUIToast('Settings Saved', 'Profile handles and statistics loaded successfully.', 'success');
    });
  }

  // 2. Add Custom Contest Submit
  const customContestForm = document.getElementById('custom-contest-form');
  if (customContestForm) {
    customContestForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('cc-name').value;
      const platform = document.getElementById('cc-platform').value;
      const url = document.getElementById('cc-url').value;
      const startTime = document.getElementById('cc-starttime').value;
      const duration = document.getElementById('cc-duration').value;

      const newContest = Storage.addCustomContest({ name, platform, url, startTime, duration, phase: 'BEFORE' });
      
      // Insert custom contest into state lists
      STATE.contests.push(newContest);
      
      // Auto-watchlist custom contest
      Storage.toggleWatchlist(newContest.id);
      STATE.watchlistIds = Storage.getWatchlist();

      // Close modal & reset form
      document.getElementById('modal-custom-contest').classList.remove('active');
      customContestForm.reset();

      // Refresh page views
      onPageChange(STATE.activePage);
      
      Notifications.createUIToast('Contest Added', `Custom contest "${name}" created and watched!`, 'success');
    });
  }

  // 3. Log Performance Form Submit
  const logForm = document.getElementById('log-performance-form');
  if (logForm) {
    logForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const contestId = document.getElementById('log-contest-id').value;
      const platform = document.getElementById('log-contest-platform').value;
      const contestName = document.getElementById('log-contest-title').textContent;
      const rank = document.getElementById('log-rank').value;
      const ratingChange = document.getElementById('log-rating-change').value;
      const solved = document.getElementById('log-solved').value;
      const total = document.getElementById('log-total').value;
      const notes = document.getElementById('log-notes').value;

      Storage.addPerformanceLog({ contestId, contestName, platform, rank, ratingChange, solved, total, notes });
      
      // Update quick dashboard stats indicators count
      updateDashboardQuickStats();

      // Close modal & reset form
      document.getElementById('modal-log-performance').classList.remove('active');
      logForm.reset();

      // Refresh current page views
      onPageChange(STATE.activePage);

      Notifications.createUIToast('Performance Logged', `Logged results for "${contestName}".`, 'success');
    });
  }

  // 4. Add Custom Problem Form Submit
  const addProblemForm = document.getElementById('add-problem-form');
  if (addProblemForm) {
    addProblemForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('prob-title').value;
      const url = document.getElementById('prob-url').value;
      const platform = document.getElementById('prob-platform').value;
      const difficulty = document.getElementById('prob-difficulty').value;
      const status = document.getElementById('prob-status').value;
      const topic = document.getElementById('prob-topic').value || 'General';

      Storage.addProblem({ title, url, platform, difficulty, status, topic });
      STATE.problems = Storage.getProblems();
      
      // Update notebook table view
      UI.renderProblemsTable(STATE.problems, '', 'all', 'all', 'all', 'all');

      // Close modal & reset form
      document.getElementById('modal-add-problem').classList.remove('active');
      addProblemForm.reset();

      Notifications.createUIToast('Problem Added', `Successfully added "${title}" to notebook.`, 'success');
    });
  }

  // 5. Add Custom Goal Form Submit
  const addGoalForm = document.getElementById('add-goal-form');
  if (addGoalForm) {
    // Hide topic input unless 'solve' is selected
    const goalTypeSelect = document.getElementById('goal-type');
    const topicGroup = document.getElementById('goal-topic-group');
    
    goalTypeSelect.addEventListener('change', () => {
      topicGroup.style.display = goalTypeSelect.value === 'solve' ? 'flex' : 'none';
    });

    addGoalForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('goal-title').value;
      const type = document.getElementById('goal-type').value;
      const target = document.getElementById('goal-target-val').value;
      const tag = document.getElementById('goal-topic-tag').value;
      const deadline = document.getElementById('goal-deadline').value;

      Storage.addGoal({ title, type, target, tag, deadline });
      STATE.goals = Storage.getGoals();
      
      // Update displays
      UI.renderGoals(STATE.goals);

      // Close modal & reset form
      document.getElementById('modal-add-goal').classList.remove('active');
      addGoalForm.reset();

      Notifications.createUIToast('Goal Set! 🎯', 'Milestone saved. Stay focused and keep pushing your limits!', 'success');
    });
  }
}

// Fetch lists from APIs and draw views asynchronously
async function loadAsyncData() {
  // 1. Fetch LeetCode POTD
  API.fetchLeetCodePOTD().then(async potd => {
    STATE.leetcodePOTD = potd;
    
    // Check if user already marked POTD as solved today
    let isSolved = STATE.problems.some(
      p => p.title === potd.title && p.sheetName === 'LEETCODE POTD' && p.status === 'solved'
    );

    // Auto-verify solve status from real LeetCode submissions if username is set
    if (!isSolved && STATE.settings.leetcodeHandle) {
      try {
        const titleSlug = potd.titleSlug || potd.link.split('/problems/')[1].split('/')[0];
        const verified = await API.verifyLeetCodePOTDSolved(STATE.settings.leetcodeHandle, titleSlug);
        if (verified) {
          Storage.saveProblem({
            title: potd.title,
            topic: potd.topicTags ? potd.topicTags.map(t => t.name).join(', ') : 'Daily Challenge',
            difficulty: potd.difficulty,
            sheetName: 'LEETCODE POTD',
            status: 'solved',
            notes: 'Verified automatically via real-time LeetCode submissions log!'
          });
          STATE.problems = Storage.getProblems();
          isSolved = true;
          Notifications.createUIToast('POTD Verified! 🔥', 'Awesome! We verified your LeetCode daily challenge solve on your profile. Keep that streak alive!', 'success');
        }
      } catch (e) {
        console.warn("Could not auto-verify LeetCode POTD solve status", e);
      }
    }
    
    UI.renderPOTDWidget(potd, isSolved);
    updateDashboardQuickStats();
  });

  // 2. Fetch Codeforces API contests and generate Mock data
  try {
    const cfContests = await API.fetchCodeforcesContests();
    const mockContests = API.generateMockContests();
    const customs = Storage.getCustomContests();

    // Merge all contest list arrays together
    STATE.contests = [...customs, ...cfContests, ...mockContests];
    
    // Sort all by time
    STATE.contests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    // Refilter dashboard widgets views
    UI.updateNextUpBanner(STATE.contests, STATE.watchlistIds);
    UI.renderDashboardWatchlist(STATE.contests, STATE.watchlistIds);
    updateDashboardQuickStats();
  } catch (err) {
    console.error("Failed to load contest schedules data", err);
  }
}

// Calculate and set numeric summary count headers on Dashboard
function updateDashboardQuickStats() {
  const registeredCount = document.getElementById('stat-registered');
  const completedCount = document.getElementById('stat-completed');
  const totalSolvedCount = document.getElementById('stat-total-solved');
  const avgRank = document.getElementById('stat-avg-rank');
  const bestRank = document.getElementById('stat-best-rank');
  const attendanceDisplay = document.getElementById('stat-attendance');

  if (!registeredCount) return;

  const logs = STATE.performanceLogs;
  
  // Registered watchlist size
  registeredCount.textContent = STATE.watchlistIds.length;
  
  // Attended & Missed contests categorization
  const attendedLogs = logs.filter(l => l.status !== 'missed');
  const missedLogs = logs.filter(l => l.status === 'missed');
  
  completedCount.textContent = attendedLogs.length;

  // Attendance Rate calculations
  if (attendanceDisplay) {
    const totalLogs = logs.length;
    if (totalLogs > 0) {
      const rate = Math.round((attendedLogs.length / totalLogs) * 100);
      attendanceDisplay.textContent = `${rate}% (${attendedLogs.length}/${totalLogs})`;
    } else {
      attendanceDisplay.textContent = '--';
    }
  }

  // Total Solved problems calculation (Local + CF live + LC live + CodeChef live)
  const localSolved = STATE.problems.filter(p => p.status === 'solved').length;
  const cfSolved = STATE.cfSubmissionsDetail ? STATE.cfSubmissionsDetail.totalSolved : 0;
  const lcSolved = STATE.leetcodeUserDetail ? STATE.leetcodeUserDetail.totalSolved : 0;
  const ccSolved = STATE.codechefUserDetail ? STATE.codechefUserDetail.totalSolved : 0;
  
  if (totalSolvedCount) {
    totalSolvedCount.textContent = localSolved + cfSolved + lcSolved + ccSolved;
  }

  // Rank statistics (only on attended logs that have rank values)
  const rankedLogs = attendedLogs.filter(l => l.rank !== null && l.rank !== '');
  if (rankedLogs.length > 0) {
    const ranks = rankedLogs.map(l => l.rank);
    
    // Average rank
    const sum = ranks.reduce((a, b) => a + b, 0);
    avgRank.textContent = `#${Math.round(sum / rankedLogs.length)}`;
    
    // Best rank
    bestRank.textContent = `#${Math.min(...ranks)}`;
  } else {
    avgRank.textContent = '--';
    bestRank.textContent = '--';
  }

  // Also sync statistics cards in sidebar
  UI.updateSidebarProfile(STATE.settings);
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
