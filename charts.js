// Chart.js Manager for Dashboard, Analytics, and Friend Comparison charts

let ratingChartInstance = null;
let topicChartInstance = null;
let friendChartInstance = null;
let activityChartInstance = null;

// Helper: generate consistent colors for platforms
const PLATFORM_COLORS = {
  codeforces: { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
  leetcode: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  codechef: { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  atcoder: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  friend: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
};

export const Charts = {
  // 1. Render/Update Rating Growth Chart
  updateRatingChart(platformFilter, cfRatingHistory, lcRatingHistory, acRatingHistory, performanceLogs, settings) {
    const ctx = document.getElementById('ratingGrowthChart');
    if (!ctx) return;

    if (ratingChartInstance) {
      ratingChartInstance.destroy();
    }

    // Build datasets based on platformFilter
    const datasets = [];

    // CF Dataset (Live Rating History)
    if (platformFilter === 'all' || platformFilter === 'codeforces') {
      if (cfRatingHistory && cfRatingHistory.length > 0) {
        datasets.push({
          label: 'Codeforces',
          data: cfRatingHistory.map(r => ({ x: new Date(r.ratingUpdateTime), y: r.rating })),
          borderColor: PLATFORM_COLORS.codeforces.border,
          backgroundColor: PLATFORM_COLORS.codeforces.bg,
          borderWidth: 2,
          tension: 0.3,
          fill: true
        });
      } else if (settings.cfHandle) {
        // Fallback baseline if no contest history but handle is set
        datasets.push({
          label: 'Codeforces (Baseline)',
          data: [{ x: new Date(), y: settings.cfRating || 1200 }],
          borderColor: PLATFORM_COLORS.codeforces.border,
          backgroundColor: PLATFORM_COLORS.codeforces.bg,
          borderWidth: 2,
          tension: 0.3
        });
      }
    }

    // Other platforms (from logged performance logs or live API history)
    const platforms = ['leetcode', 'codechef', 'atcoder'];
    platforms.forEach(p => {
      if (platformFilter === 'all' || platformFilter === p) {
        if (p === 'leetcode' && lcRatingHistory && lcRatingHistory.length > 0) {
          datasets.push({
            label: 'LeetCode (Live)',
            data: lcRatingHistory.map(r => ({ x: new Date(r.ratingUpdateTime), y: r.rating })),
            borderColor: PLATFORM_COLORS.leetcode.border,
            backgroundColor: PLATFORM_COLORS.leetcode.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true
          });
        } else if (p === 'atcoder' && acRatingHistory && acRatingHistory.length > 0) {
          datasets.push({
            label: 'AtCoder (Live)',
            data: acRatingHistory.map(r => ({ x: new Date(r.ratingUpdateTime), y: r.rating })),
            borderColor: PLATFORM_COLORS.atcoder.border,
            backgroundColor: PLATFORM_COLORS.atcoder.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true
          });
        } else {
          const logs = performanceLogs
            .filter(l => l.platform === p && l.ratingChange !== null)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          if (logs.length > 0) {
            // Accumulate rating changes from baseline
            let currentRating = 0;
            if (p === 'leetcode') currentRating = settings.leetcodeRating || 1500;
            if (p === 'codechef') currentRating = settings.codechefRating || 1400;
            if (p === 'atcoder') currentRating = settings.atcoderRating || 1200;

            const dataPoints = [{ x: new Date(new Date(logs[0].date).getTime() - 24*60*60*1000), y: currentRating }]; // Baseline point
            
            logs.forEach(log => {
              currentRating += log.ratingChange;
              dataPoints.push({
                x: new Date(log.date),
                y: currentRating
              });
            });

            datasets.push({
              label: p.charAt(0).toUpperCase() + p.slice(1),
              data: dataPoints,
              borderColor: PLATFORM_COLORS[p].border,
              backgroundColor: PLATFORM_COLORS[p].bg,
              borderWidth: 2,
              tension: 0.3,
              fill: true
            });
          }
        }
      }
    });

    // Create Chart
    ratingChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM dd'
              }
            },
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            title: { display: true, text: 'Date', color: '#475569' },
            ticks: { color: '#475569' }
          },
          y: {
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            title: { display: true, text: 'Rating', color: '#475569' },
            ticks: { color: '#475569' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Outfit' } }
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                return new Date(context[0].raw.x).toLocaleDateString();
              }
            }
          }
        }
      }
    });
  },

  // 2. Render/Update Topic-wise Solve Stats
  updateTopicSolveChart(problems, cfSubmissions) {
    const ctx = document.getElementById('topicSolveChart');
    if (!ctx) return;

    if (topicChartInstance) {
      topicChartInstance.destroy();
    }

    const CF_TAG_MAPPING = {
      'dp': 'Dynamic Programming',
      'graphs': 'Graphs',
      'shortest paths': 'Graphs',
      'dfs and similar': 'Graphs',
      'trees': 'Trees',
      'greedy': 'Greedy',
      'math': 'Math',
      'number theory': 'Math',
      'strings': 'Strings',
      'string suffix structures': 'Strings',
      'data structures': 'Data Structures',
      'sortings': 'Sorting',
      'binary search': 'Binary Search',
      'two pointers': 'Two Pointers',
      'divide and conquer': 'Divide and Conquer',
      'bitmasks': 'Bitmasks',
      'combinatorics': 'Math',
      'probabilities': 'Math',
      'matrices': 'Math',
      'games': 'Game Theory',
      'brute force': 'Brute Force'
    };

    // Count solved problems per topic
    const topicCounts = {};
    
    // 1. Local Problems
    problems.forEach(p => {
      if (p.status === 'solved') {
        const topic = p.topic || 'General';
        const tags = topic.split(',').map(t => t.trim());
        tags.forEach(tag => {
          if (tag) {
            topicCounts[tag] = (topicCounts[tag] || 0) + 1;
          }
        });
      }
    });

    // 2. Codeforces Submissions
    if (cfSubmissions && cfSubmissions.topicCounts) {
      Object.keys(cfSubmissions.topicCounts).forEach(cfTag => {
        const standardTopic = CF_TAG_MAPPING[cfTag] || cfTag.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const count = cfSubmissions.topicCounts[cfTag];
        topicCounts[standardTopic] = (topicCounts[standardTopic] || 0) + count;
      });
    }

    const labels = Object.keys(topicCounts);
    const data = Object.values(topicCounts);

    // Fallback if empty
    if (labels.length === 0) {
      labels.push("No Solved Problems Yet");
      data.push(0);
    }

    topicChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Problems Solved',
          data,
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          borderColor: '#06b6d4',
          borderWidth: 2,
          pointBackgroundColor: '#06b6d4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            angleLines: { color: 'rgba(15, 23, 42, 0.06)' },
            pointLabels: { color: '#0f172a', font: { family: 'Outfit', size: 10 } },
            ticks: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  },

  // 3. Render/Update Friend Comparison Chart (CF rating comparison)
  updateFriendComparisonChart(userHandle, userHistory, friendHandle, friendHistory) {
    const ctx = document.getElementById('friendComparisonChart');
    if (!ctx) return;

    if (friendChartInstance) {
      friendChartInstance.destroy();
    }

    const datasets = [];

    // User's Rating History dataset
    if (userHistory && userHistory.length > 0) {
      datasets.push({
        label: userHandle,
        data: userHistory.map(r => ({ x: new Date(r.ratingUpdateTime), y: r.rating })),
        borderColor: PLATFORM_COLORS.codeforces.border,
        backgroundColor: PLATFORM_COLORS.codeforces.bg,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      });
    }

    // Friend's Rating History dataset
    if (friendHistory && friendHistory.length > 0) {
      datasets.push({
        label: friendHandle,
        data: friendHistory.map(r => ({ x: new Date(r.ratingUpdateTime), y: r.rating })),
        borderColor: PLATFORM_COLORS.friend.border,
        backgroundColor: PLATFORM_COLORS.friend.bg,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      });
    }

    friendChartInstance = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: { day: 'MMM dd' }
            },
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: { color: '#475569' }
          },
          y: {
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: { color: '#475569' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Outfit' } }
          }
        }
      }
    });
  },

  // 4. Analyze weak topics based on problem statuses & reviews
  calculateWeakTopics(problems, logs) {
    const container = document.getElementById('weakness-analysis-container');
    if (!container) return;

    // Collate problems by topics
    const topicStats = {};
    problems.forEach(p => {
      const topic = p.topic || 'General';
      const tags = topic.split(',').map(t => t.trim());
      
      tags.forEach(tag => {
        if (!tag) return;
        if (!topicStats[tag]) {
          topicStats[tag] = { total: 0, solved: 0, review: 0, todo: 0 };
        }
        
        topicStats[tag].total++;
        if (p.status === 'solved') topicStats[tag].solved++;
        else if (p.status === 'review') topicStats[tag].review++;
        else if (p.status === 'todo') topicStats[tag].todo++;
      });
    });

    const weakTopicsList = [];

    // Analyze topics where "review" is high OR solve ratio is less than 40% (if total > 2)
    Object.keys(topicStats).forEach(topic => {
      const stats = topicStats[topic];
      const solveRatio = stats.solved / stats.total;
      
      // Flags: high review, low solve ratio
      if (stats.review > 0 || (stats.total >= 3 && solveRatio < 0.4)) {
        weakTopicsList.push({
          name: topic,
          solved: stats.solved,
          total: stats.total,
          reviewCount: stats.review,
          solveRatio
        });
      }
    });

    // Sort by weakness severity (more review questions first, then lower solve ratios)
    weakTopicsList.sort((a, b) => b.reviewCount - a.reviewCount || a.solveRatio - b.solveRatio);

    if (weakTopicsList.length === 0) {
      container.innerHTML = `
        <div class="weakness-empty-state">
          <h4>🌟 Looking Solid!</h4>
          <p>No critical topic weaknesses flagged. Keep solving problems and logging your contest reviews to update this analysis.</p>
        </div>
      `;
      return;
    }

    let html = '';
    weakTopicsList.slice(0, 3).forEach(item => {
      let advice = '';
      if (item.reviewCount > 0) {
        advice = `Oops! You've got <strong>${item.reviewCount}</strong> problems flagged for review here. Don't skip them—re-attempt them to lock in the concepts! 🧠`;
      } else {
        advice = `Only a ${Math.round(item.solveRatio * 100)}% solve rate on this topic. We highly recommend importing a NeetCode sheet to get some focused practice on this! 💻`;
      }

      html += `
        <div class="weakness-item">
          <div class="weakness-item-header">
            <span class="weakness-topic-name">${item.name}</span>
            <span class="weakness-solve-ratio">${item.solved}/${item.total} Solved</span>
          </div>
          <p class="weakness-advice">${advice}</p>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // 4. Render/Update Daily Solved Activity stacked Bar Chart
  updateDailyActivityChart(problems, cfSubmissions) {
    const ctx = document.getElementById('dailyActivityChart');
    if (!ctx) return;

    if (activityChartInstance) {
      activityChartInstance.destroy();
    }

    // 1. Generate dates for the last 7 days
    const dates = [];
    const dateLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
      dateLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }

    const getLocalDateStr = (d) => {
      return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    };

    const dateKeys = dates.map(d => getLocalDateStr(d));

    // Initialize counts arrays
    const cfCounts = new Array(7).fill(0);
    const lcCounts = new Array(7).fill(0);
    const otherCounts = new Array(7).fill(0);

    // 2. Count Codeforces live solves per day
    if (cfSubmissions && cfSubmissions.dailySolves) {
      dateKeys.forEach((key, idx) => {
        if (cfSubmissions.dailySolves[key]) {
          cfCounts[idx] = cfSubmissions.dailySolves[key];
        }
      });
    }

    // 3. Count Local / LeetCode / custom problems solved per day
    problems.forEach(p => {
      if (p.status === 'solved' && p.dateAdded) {
        const pDate = new Date(p.dateAdded);
        const pDateStr = getLocalDateStr(pDate);
        const idx = dateKeys.indexOf(pDateStr);
        if (idx !== -1) {
          if (p.sheetName === 'LEETCODE POTD' || p.sheetName.toLowerCase().includes('neetcode')) {
            lcCounts[idx]++;
          } else {
            otherCounts[idx]++;
          }
        }
      }
    });

    activityChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dateLabels,
        datasets: [
          {
            label: 'Codeforces',
            data: cfCounts,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#f43f5e',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'LeetCode',
            data: lcCounts,
            backgroundColor: 'rgba(245, 158, 11, 0.75)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Others',
            data: otherCounts,
            backgroundColor: 'rgba(6, 182, 212, 0.75)',
            borderColor: '#06b6d4',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#475569', font: { family: 'Outfit', size: 10 } }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: { precision: 0, color: '#475569', font: { family: 'Outfit', size: 10 } }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#0f172a', font: { family: 'Outfit', size: 10 } }
          }
        }
      }
    });
  }
};
