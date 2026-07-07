// LocalStorage State Management for Contest Tracker

const KEYS = {
  SETTINGS: 'apex_settings',
  CUSTOM_CONTESTS: 'apex_custom_contests',
  WATCHLIST: 'apex_watchlist',
  PERFORMANCE_LOGS: 'apex_performance_logs',
  PROBLEMS: 'apex_problems',
  GOALS: 'apex_goals'
};

// Initial Default Settings
const DEFAULT_SETTINGS = {
  cfHandle: '',
  leetcodeHandle: '',
  codechefHandle: '',
  atcoderHandle: '',
  leetcodeRating: 1500,
  codechefRating: 1400,
  atcoderRating: 1200,
  notify: true,
  sound: true
};

// Helper: safe JSON parsing
const getLocal = (key, fallback) => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error parsing LocalStorage key: ${key}`, e);
    return fallback;
  }
};

const setLocal = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));

  // Asynchronously sync with the backend server database
  let apiPath = '';
  if (key === KEYS.SETTINGS) apiPath = '/api/user/settings';
  else if (key === KEYS.PROBLEMS) apiPath = '/api/user/problems';
  else if (key === KEYS.WATCHLIST) apiPath = '/api/user/watchlist';
  else if (key === KEYS.PERFORMANCE_LOGS) apiPath = '/api/user/logs';
  else if (key === KEYS.GOALS) apiPath = '/api/user/goals';
  else if (key === KEYS.CUSTOM_CONTESTS) apiPath = '/api/user/custom-contests';
  
  if (apiPath) {
    fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    }).catch(err => {
      console.warn(`Failed to sync key ${key} with backend server`, err);
    });
  }
};

export const Storage = {
  // Settings Management
  getSettings() {
    return getLocal(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },
  
  saveSettings(settings) {
    const current = this.getSettings();
    setLocal(KEYS.SETTINGS, { ...current, ...settings });
  },

  // Custom Contests
  getCustomContests() {
    return getLocal(KEYS.CUSTOM_CONTESTS, []);
  },

  addCustomContest(contest) {
    const contests = this.getCustomContests();
    const newContest = {
      id: 'custom_' + Date.now(),
      ...contest,
      duration: parseInt(contest.duration) || 120,
      startTime: new Date(contest.startTime).toISOString()
    };
    contests.push(newContest);
    setLocal(KEYS.CUSTOM_CONTESTS, contests);
    this.updateGoalsProgress('contest');
    return newContest;
  },

  deleteCustomContest(id) {
    const contests = this.getCustomContests();
    setLocal(KEYS.CUSTOM_CONTESTS, contests.filter(c => c.id !== id));
  },

  // Watchlist (Starred) Contests
  getWatchlist() {
    return getLocal(KEYS.WATCHLIST, []);
  },

  toggleWatchlist(contestId) {
    const watchlist = this.getWatchlist();
    const index = watchlist.indexOf(contestId);
    let added = false;
    if (index === -1) {
      watchlist.push(contestId);
      added = true;
    } else {
      watchlist.splice(index, 1);
    }
    setLocal(KEYS.WATCHLIST, watchlist);
    return added;
  },

  isWatched(contestId) {
    return this.getWatchlist().includes(contestId);
  },

  // Performance Logs (Finished Contests)
  getPerformanceLogs() {
    return getLocal(KEYS.PERFORMANCE_LOGS, []);
  },

  addPerformanceLog(log) {
    const logs = this.getPerformanceLogs();
    const newLog = {
      id: 'log_' + Date.now(),
      date: new Date().toISOString(),
      status: 'attended',
      ...log,
      rank: log.rank !== undefined && log.rank !== null && log.rank !== '' ? parseInt(log.rank) : null,
      solved: log.solved !== undefined && log.solved !== null && log.solved !== '' ? parseInt(log.solved) : null,
      total: log.total !== undefined && log.total !== null && log.total !== '' ? parseInt(log.total) : null,
      ratingChange: log.ratingChange ? parseInt(log.ratingChange) : null
    };
    logs.push(newLog);
    setLocal(KEYS.PERFORMANCE_LOGS, logs);
    
    // Update contest and rating goals
    this.updateGoalsProgress('contest');
    if (log.ratingChange) {
      this.updateRatingGoals(log.platform, log.ratingChange);
    }
    
    return newLog;
  },

  deletePerformanceLog(id) {
    const logs = this.getPerformanceLogs();
    setLocal(KEYS.PERFORMANCE_LOGS, logs.filter(l => l.id !== id));
  },

  // Problems notebook
  getProblems() {
    const defaultProblems = [
      {
        id: 'default_1',
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum',
        platform: 'leetcode',
        difficulty: 'Easy',
        topic: 'Arrays & Hashing',
        status: 'solved',
        notes: '# Two Sum\nUse a Hash Map to store the complement of each element target-nums[i] alongside its index. Time complexity O(N), Space complexity O(N).',
        sheetName: 'Custom',
        dateAdded: new Date().toISOString()
      },
      {
        id: 'default_2',
        title: '3Sum',
        url: 'https://leetcode.com/problems/3sum',
        platform: 'leetcode',
        difficulty: 'Medium',
        topic: 'Two Pointers',
        status: 'todo',
        notes: '',
        sheetName: 'Custom',
        dateAdded: new Date().toISOString()
      }
    ];
    return getLocal(KEYS.PROBLEMS, defaultProblems);
  },

  saveProblems(problems) {
    setLocal(KEYS.PROBLEMS, problems);
  },

  addProblem(problem) {
    const problems = this.getProblems();
    const newProblem = {
      id: 'prob_' + Date.now(),
      notes: '',
      sheetName: 'Custom',
      dateAdded: new Date().toISOString(),
      ...problem
    };
    problems.push(newProblem);
    this.saveProblems(problems);
    
    if (newProblem.status === 'solved') {
      this.updateGoalsProgress('solve', newProblem.topic);
    }
    return newProblem;
  },

  importDSASheet(sheetName, questionsList) {
    const problems = this.getProblems();
    let importCount = 0;
    
    questionsList.forEach(q => {
      // Check if problem already exists in list (by matching title & platform)
      const exists = problems.some(p => p.title.toLowerCase() === q.title.toLowerCase() && p.platform === q.platform);
      if (!exists) {
        problems.push({
          id: 'prob_sheet_' + sheetName + '_' + Math.random().toString(36).substr(2, 9),
          title: q.title,
          url: q.url,
          platform: q.platform,
          difficulty: q.difficulty,
          topic: q.topic,
          status: 'todo',
          notes: '',
          sheetName: sheetName,
          dateAdded: new Date().toISOString()
        });
        importCount++;
      }
    });
    
    this.saveProblems(problems);
    return importCount;
  },

  updateProblemStatus(id, newStatus) {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === id);
    if (problem) {
      const oldStatus = problem.status;
      problem.status = newStatus;
      this.saveProblems(problems);
      
      // Update goals if status changed to/from Solved
      if (newStatus === 'solved' && oldStatus !== 'solved') {
        this.updateGoalsProgress('solve', problem.topic);
      } else if (oldStatus === 'solved' && newStatus !== 'solved') {
        this.updateGoalsProgress('solve', problem.topic, -1);
      }
    }
  },

  updateProblemNotes(id, notes) {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === id);
    if (problem) {
      problem.notes = notes;
      this.saveProblems(problems);
    }
  },

  deleteProblem(id) {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === id);
    if (problem) {
      const filtered = problems.filter(p => p.id !== id);
      this.saveProblems(filtered);
      if (problem.status === 'solved') {
        this.updateGoalsProgress('solve', problem.topic, -1);
      }
    }
  },

  // Goal Tracking
  getGoals() {
    const defaultGoals = [
      {
        id: 'g_default_1',
        title: 'Solve 10 Array & Hashing Problems',
        type: 'solve',
        target: 10,
        current: 1, // 'Two Sum' default is solved
        tag: 'Arrays & Hashing',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: false
      },
      {
        id: 'g_default_2',
        title: 'Participate in 3 coding contests',
        type: 'contest',
        target: 3,
        current: 0,
        tag: '',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: false
      }
    ];
    return getLocal(KEYS.GOALS, defaultGoals);
  },

  saveGoals(goals) {
    setLocal(KEYS.GOALS, goals);
  },

  addGoal(goal) {
    const goals = this.getGoals();
    const newGoal = {
      id: 'goal_' + Date.now(),
      current: 0,
      completed: false,
      ...goal,
      target: parseInt(goal.target)
    };
    
    // Auto-calculate initial progress for solved topics
    if (newGoal.type === 'solve') {
      const solvedCount = this.getProblems().filter(
        p => p.status === 'solved' && p.topic.toLowerCase() === newGoal.tag.toLowerCase()
      ).length;
      newGoal.current = Math.min(solvedCount, newGoal.target);
      newGoal.completed = newGoal.current >= newGoal.target;
    } else if (newGoal.type === 'contest') {
      const logsCount = this.getPerformanceLogs().length;
      newGoal.current = Math.min(logsCount, newGoal.target);
      newGoal.completed = newGoal.current >= newGoal.target;
    }
    
    goals.push(newGoal);
    this.saveGoals(goals);
    return newGoal;
  },

  deleteGoal(id) {
    const goals = this.getGoals();
    this.saveGoals(goals.filter(g => g.id !== id));
  },

  updateGoalsProgress(type, tag = '', increment = 1) {
    const goals = this.getGoals();
    let updated = false;
    
    goals.forEach(goal => {
      if (goal.completed) return;
      
      if (goal.type === type) {
        if (type === 'solve') {
          // Verify topic tag matches
          if (tag && goal.tag && tag.toLowerCase() === goal.tag.toLowerCase()) {
            goal.current = Math.max(0, goal.current + increment);
            if (goal.current >= goal.target) {
              goal.completed = true;
            }
            updated = true;
          }
        } else if (type === 'contest') {
          goal.current = Math.max(0, goal.current + increment);
          if (goal.current >= goal.target) {
            goal.completed = true;
          }
          updated = true;
        }
      }
    });
    
    if (updated) {
      this.saveGoals(goals);
    }
  },

  updateRatingGoals(platform, ratingChange) {
    const goals = this.getGoals();
    const settings = this.getSettings();
    let platformRating = 1500;
    
    // Determine current rating
    if (platform === 'leetcode') platformRating = settings.leetcodeRating;
    else if (platform === 'codechef') platformRating = settings.codechefRating;
    else if (platform === 'atcoder') platformRating = settings.atcoderRating;
    
    let updated = false;
    goals.forEach(goal => {
      if (goal.completed) return;
      if (goal.type === 'rating') {
        // If rating target reached
        if (platformRating >= goal.target) {
          goal.current = platformRating;
          goal.completed = true;
          updated = true;
        } else {
          // Display progress as rating percentage or current rating value
          goal.current = platformRating;
          updated = true;
        }
      }
    });
    
    if (updated) {
      this.saveGoals(goals);
    }
  }
};
