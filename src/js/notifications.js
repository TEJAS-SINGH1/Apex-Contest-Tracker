// Notification & Sound System for Contest Reminders

// Synthesize a premium double chime using browser Web Audio API (no external sound file needed!)
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First chime node
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);

    // Second chime node (slightly delayed and higher pitch)
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain2.gain.setValueAtTime(0.15, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.6);
    }, 180);
  } catch (e) {
    console.warn("AudioContext block/error", e);
  }
}

// Track sent notifications in-memory to prevent duplicates
const sentNotifications = new Set();

export const Notifications = {
  // Request desktop notification permissions
  async requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return false;
  },

  // Check watchlists and trigger alerts if contest starts in 15 or 5 mins
  checkContestAlarms(contests, watchlistIds, settings) {
    if (!settings.notify) return;
    
    const now = Date.now();
    
    contests.forEach(contest => {
      if (!watchlistIds.includes(contest.id)) return;
      
      const startTime = new Date(contest.startTime).getTime();
      const msLeft = startTime - now;
      const minsLeft = Math.floor(msLeft / 60000);

      // We alert at 15 minutes and 5 minutes
      if (minsLeft === 15 || minsLeft === 5) {
        const alertKey = `${contest.id}_${minsLeft}`;
        
        if (!sentNotifications.has(alertKey)) {
          sentNotifications.add(alertKey);
          
          this.triggerAlert(
            `Contest Starting Soon!`,
            `"${contest.name}" starts in ${minsLeft} minutes. Get ready!`,
            settings.sound,
            contest.url
          );
        }
      }
    });
  },

  // Fire the actual notification and sound
  triggerAlert(title, body, playSound, clickUrl) {
    // 1. Play the synthesized chime
    if (playSound) {
      playChime();
    }

    // 2. Desktop notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/favicon.ico' // fallback
        });
        
        notification.onclick = () => {
          window.focus();
          if (clickUrl) window.open(clickUrl, '_blank');
        };
      } catch (e) {
        console.error("Desktop notification failed to show", e);
      }
    }
    
    // 3. UI Toast notification fallback
    this.createUIToast(title, body);
  },

  // Creates inside-app toast alert fallback
  createUIToast(title, body, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
      <div class="toast-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      </div>
      <div class="toast-info">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${body}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Close button event
    toast.querySelector('.toast-close').onclick = () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    };
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }
};
