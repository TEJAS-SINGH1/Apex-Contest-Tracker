// API Integration Module for Codeforces, LeetCode, and mock platform data

const LEETCODE_POTD_FALLBACKS = [
  { title: "Two Sum", difficulty: "Easy", topicTags: [{ name: "Arrays" }, { name: "Hash Table" }], link: "https://leetcode.com/problems/two-sum" },
  { title: "Longest Substring Without Repeating Characters", difficulty: "Medium", topicTags: [{ name: "Hash Table" }, { name: "String" }, { name: "Sliding Window" }], link: "https://leetcode.com/problems/longest-substring-without-repeating-characters" },
  { title: "Median of Two Sorted Arrays", difficulty: "Hard", topicTags: [{ name: "Array" }, { name: "Binary Search" }, { name: "Divide and Conquer" }], link: "https://leetcode.com/problems/median-of-two-sorted-arrays" },
  { title: "Container With Most Water", difficulty: "Medium", topicTags: [{ name: "Array" }, { name: "Two Pointers" }], link: "https://leetcode.com/problems/container-with-most-water" },
  { title: "Climbing Stairs", difficulty: "Easy", topicTags: [{ name: "Math" }, { name: "Dynamic Programming" }], link: "https://leetcode.com/problems/climbing-stairs" },
  { title: "Edit Distance", difficulty: "Hard", topicTags: [{ name: "String" }, { name: "Dynamic Programming" }], link: "https://leetcode.com/problems/edit-distance" }
];

export const API = {
  // Fetch Codeforces Contests
  async fetchCodeforcesContests() {
    try {
      const response = await fetch('https://codeforces.com/api/contest.list?gym=false');
      const data = await response.json();
      if (data.status === 'OK') {
        // Map to standard internal format
        return data.result.map(c => ({
          id: 'cf_' + c.id,
          name: c.name,
          platform: 'codeforces',
          url: `https://codeforces.com/contest/${c.id}`,
          startTime: new Date(c.startTimeSeconds * 1000).toISOString(),
          duration: Math.round(c.durationSeconds / 60), // in minutes
          phase: c.phase // BEFORE, CODING, FINISHED
        }));
      }
      throw new Error('Codeforces API status was not OK');
    } catch (e) {
      console.warn('Failed to fetch Codeforces contests, using fallback', e);
      return [];
    }
  },

  // Fetch Codeforces User Info (Rating, Rank, Avatar)
  async fetchCodeforcesUser(handle) {
    if (!handle) return null;
    try {
      const response = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
      const data = await response.json();
      if (data.status === 'OK' && data.result.length > 0) {
        const u = data.result[0];
        return {
          handle: u.handle,
          rating: u.rating || 0,
          maxRating: u.maxRating || 0,
          rank: u.rank || 'Unrated',
          maxRank: u.maxRank || 'Unrated',
          avatar: u.titlePhoto || ''
        };
      }
      throw new Error('User not found');
    } catch (e) {
      console.error(`Failed to fetch user info for ${handle}`, e);
      return null;
    }
  },

  // Fetch Codeforces User Rating History
  async fetchCodeforcesRatingHistory(handle) {
    if (!handle) return [];
    try {
      const response = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
      const data = await response.json();
      if (data.status === 'OK') {
        return data.result.map(r => ({
          contestId: r.contestId,
          contestName: r.contestName,
          rank: r.rank,
          ratingUpdateTime: r.ratingUpdateTimeSeconds * 1000,
          rating: r.newRating
        }));
      }
      throw new Error('Rating fetch failed');
    } catch (e) {
      console.error(`Failed to fetch rating history for ${handle}`, e);
      return [];
    }
  },

  // Fetch Codeforces Solved Problems & Submissions (with tags count)
  async fetchCodeforcesSubmissions(handle) {
    if (!handle) return { totalSolved: 0, topicCounts: {} };
    try {
      const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
      const data = await response.json();
      if (data.status === 'OK') {
        const solved = new Set();
        const topicCounts = {};
        const dailySolves = {};
        
        data.result.forEach(sub => {
          if (sub.verdict === 'OK') {
            const probId = `${sub.problem.contestId}_${sub.problem.index}`;
            if (!solved.has(probId)) {
              solved.add(probId);
              // Count tags
              if (sub.problem.tags) {
                sub.problem.tags.forEach(tag => {
                  topicCounts[tag] = (topicCounts[tag] || 0) + 1;
                });
              }
              // Count daily solves
              const date = new Date(sub.creationTimeSeconds * 1000);
              const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
              dailySolves[dateStr] = (dailySolves[dateStr] || 0) + 1;
            }
          }
        });

        return {
          totalSolved: solved.size,
          topicCounts,
          dailySolves
        };
      }
      throw new Error("CF Submissions fetch failed");
    } catch (e) {
      console.error(`Failed to fetch CF submissions for ${handle}`, e);
      return { totalSolved: 0, topicCounts: {} };
    }
  },

  // Verify if LeetCode POTD is solved by the user (checks last 20 accepted submissions)
  async verifyLeetCodePOTDSolved(username, potdTitleSlug) {
    if (!username || !potdTitleSlug) return false;
    try {
      const response = await fetch(`/api/proxy/leetcode/submissions/${username}`);
      const data = await response.json();
      if (data && Array.isArray(data.submission)) {
        const solvedToday = data.submission.some(sub => {
          if (sub.titleSlug !== potdTitleSlug) return false;
          
          const subDate = new Date(parseInt(sub.timestamp) * 1000);
          const subDateStr = `${subDate.getFullYear()}-${(subDate.getMonth()+1).toString().padStart(2,'0')}-${subDate.getDate().toString().padStart(2,'0')}`;
          
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
          
          return subDateStr === todayStr;
        });
        return solvedToday;
      }
      return false;
    } catch (e) {
      console.error(`Failed to verify LeetCode POTD solve for ${username}`, e);
      return false;
    }
  },

  // Fetch LeetCode User Profile Detail
  async fetchLeetCodeUser(username) {
    if (!username) return null;
    try {
      const response = await fetch(`/api/proxy/leetcode/user/${username}`);
      const data = await response.json();
      if (data && !data.errors) {
        return {
          username: data.username,
          ranking: data.ranking || '--',
          totalSolved: data.totalSolved || (data.solvedProblem ? data.solvedProblem.totalSolved : 0),
          avatar: data.avatar || ''
        };
      }
      throw new Error('LeetCode user not found');
    } catch (e) {
      console.error(`Failed to fetch LeetCode user info for ${username}`, e);
      return null;
    }
  },

  // Fetch LeetCode Rating History
  async fetchLeetCodeRatingHistory(username) {
    if (!username) return [];
    try {
      const response = await fetch(`/api/proxy/leetcode/history/${username}`);
      const data = await response.json();
      if (data && data.contestHistory) {
        return data.contestHistory
          .filter(c => c.attended)
          .map(c => ({
            contestName: c.contest.title,
            rank: c.ranking,
            ratingUpdateTime: c.contest.startTime * 1000,
            rating: Math.round(c.rating)
          }));
      }
      throw new Error('LeetCode contest history not found');
    } catch (e) {
      console.error(`Failed to fetch LeetCode contest rating history for ${username}`, e);
      return [];
    }
  },

  // Fetch CodeChef User Details & Rating
  async fetchCodeChefUser(username) {
    if (!username) return null;
    try {
      const response = await fetch(`/api/proxy/codechef/${username}`);
      const data = await response.json();
      if (data && data.rating) {
        return {
          username: data.username || username,
          rating: parseInt(data.rating) || 0,
          highestRating: parseInt(data.highestRating) || 0,
          globalRank: data.globalRank || '--',
          totalSolved: parseInt(data.fullySolved) || 0,
          stars: data.stars || ''
        };
      }
      throw new Error('CodeChef user not found');
    } catch (e) {
      console.error(`Failed to fetch CodeChef user info for ${username}`, e);
      return null;
    }
  },

  // Fetch AtCoder Rating History
  async fetchAtCoderRatingHistory(username) {
    if (!username) return [];
    try {
      const response = await fetch(`/api/proxy/atcoder/history/${username}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        return data
          .filter(c => c.IsRated)
          .map(c => ({
            contestName: c.ContestName,
            rank: c.Place,
            ratingUpdateTime: new Date(c.EndTime).getTime(),
            rating: c.NewRating
          }));
      }
      throw new Error('AtCoder history not array');
    } catch (e) {
      console.error(`Failed to fetch AtCoder history for ${username}`, e);
      return [];
    }
  },

  // Fetch AtCoder User Details (Rating, Max Rating derived from history)
  async fetchAtCoderUser(username) {
    if (!username) return null;
    try {
      const history = await this.fetchAtCoderRatingHistory(username);
      if (history.length > 0) {
        const last = history[history.length - 1];
        const maxRating = Math.max(...history.map(h => h.rating));
        return {
          username,
          rating: last.rating,
          maxRating: maxRating,
          rank: last.rank || '--'
        };
      }
      return {
        username,
        rating: 0,
        maxRating: 0,
        rank: 'Unrated'
      };
    } catch (e) {
      console.error(`Failed to fetch AtCoder user info for ${username}`, e);
      return null;
    }
  },

  // Fetch LeetCode POTD
  async fetchLeetCodePOTD() {
    try {
      // First attempt to call the open leetcode wrapper API
      const response = await fetch('/api/proxy/leetcode/potd', { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      if (data && data.questionTitle) {
        return {
          title: data.questionTitle,
          difficulty: data.difficulty,
          topicTags: data.topicTags || [{ name: "Coding" }],
          link: data.questionLink
        };
      }
    } catch (e) {
      console.warn("Leetcode POTD API failed or timed out. Attempting CORS proxy fallback.", e);
      // Second attempt using CORS proxy
      try {
        const graphqlQuery = {
          query: `
            query {
              activeDailyCodingChallengeQuestion {
                link
                question {
                  title
                  difficulty
                  topicTags { name }
                }
              }
            }
          `
        };
        const corsResponse = await fetch('https://corsproxy.io/?url=https://leetcode.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graphqlQuery),
          signal: AbortSignal.timeout(4000)
        });
        const resData = await corsResponse.json();
        const daily = resData.data.activeDailyCodingChallengeQuestion;
        return {
          title: daily.question.title,
          difficulty: daily.question.difficulty,
          topicTags: daily.question.topicTags,
          link: 'https://leetcode.com' + daily.link
        };
      } catch (corsErr) {
        console.error("CORS Proxy Leetcode daily query failed. Loading local static POTD.", corsErr);
      }
    }

    // Static resilient fallback based on the current calendar day
    const day = new Date().getDate();
    const fallback = LEETCODE_POTD_FALLBACKS[day % LEETCODE_POTD_FALLBACKS.length];
    return fallback;
  },

  // Generates Live simulated upcoming/active/finished contests for platforms without public keyless APIs
  generateMockContests() {
    const contests = [];
    const now = new Date();
    
    // Platforms: leetcode, codechef, atcoder
    const mockConfigs = [
      {
        platform: 'leetcode',
        namePrefix: 'LeetCode Weekly Contest',
        duration: 90,
        url: 'https://leetcode.com/contest/',
        // Weekly on Sundays at 8:00 AM UTC
        dayOfWeek: 0,
        hour: 8,
        intervalWeeks: 1
      },
      {
        platform: 'leetcode',
        namePrefix: 'LeetCode Biweekly Contest',
        duration: 90,
        url: 'https://leetcode.com/contest/',
        // Every second Saturday at 2:30 PM UTC
        dayOfWeek: 6,
        hour: 14,
        intervalWeeks: 2
      },
      {
        platform: 'codechef',
        namePrefix: 'CodeChef Starters',
        duration: 120,
        url: 'https://www.codechef.com/contests',
        // Wednesdays at 2:30 PM UTC
        dayOfWeek: 3,
        hour: 14,
        intervalWeeks: 1
      },
      {
        platform: 'atcoder',
        namePrefix: 'AtCoder Beginner Contest',
        duration: 100,
        url: 'https://atcoder.jp/contests/',
        // Saturdays at 12:00 PM UTC
        dayOfWeek: 6,
        hour: 12,
        intervalWeeks: 1
      }
    ];

    mockConfigs.forEach((config, idx) => {
      // Create one finished contest (yesterday/past)
      const finishedDate = new Date(now);
      finishedDate.setDate(now.getDate() - 2);
      contests.push({
        id: `mock_finished_${config.platform}_${idx}`,
        name: `${config.namePrefix} ${380 + idx}`,
        platform: config.platform,
        url: config.url,
        startTime: finishedDate.toISOString(),
        duration: config.duration,
        phase: 'FINISHED'
      });

      // Create one active contest (currently running, starts 1 hour ago)
      const activeDate = new Date(now);
      activeDate.setHours(now.getHours() - 1);
      contests.push({
        id: `mock_active_${config.platform}_${idx}`,
        name: `${config.namePrefix} ${381 + idx}`,
        platform: config.platform,
        url: config.url,
        startTime: activeDate.toISOString(),
        duration: config.duration,
        phase: 'CODING'
      });

      // Create one upcoming contest (soon: 6 hours from now)
      const upcomingSoonDate = new Date(now);
      upcomingSoonDate.setHours(now.getHours() + 6);
      contests.push({
        id: `mock_soon_${config.platform}_${idx}`,
        name: `${config.namePrefix} ${382 + idx}`,
        platform: config.platform,
        url: config.url,
        startTime: upcomingSoonDate.toISOString(),
        duration: config.duration,
        phase: 'BEFORE'
      });

      // Create one upcoming contest (later: next week scheduled)
      const upcomingLaterDate = new Date(now);
      const daysDiff = (config.dayOfWeek + 7 - now.getDay()) % 7;
      upcomingLaterDate.setDate(now.getDate() + (daysDiff === 0 ? 7 : daysDiff));
      upcomingLaterDate.setHours(config.hour, 0, 0, 0);
      contests.push({
        id: `mock_later_${config.platform}_${idx}`,
        name: `${config.namePrefix} ${383 + idx}`,
        platform: config.platform,
        url: config.url,
        startTime: upcomingLaterDate.toISOString(),
        duration: config.duration,
        phase: 'BEFORE'
      });
    });

    return contests;
  }
};
