// Performance monitoring utility
const performanceMonitor = {
  timers: {},
  pageLoads: {},

  startTimer(name) {
    this.timers[name] = {
      start: performance.now(),
      end: null,
      duration: null
    };
    console.log(`[Performance] Started timer: ${name}`);
  },

  endTimer(name) {
    if (this.timers[name]) {
      this.timers[name].end = performance.now();
      this.timers[name].duration = this.timers[name].end - this.timers[name].start;
      console.log(`[Performance] Timer ${name} completed in ${this.timers[name].duration.toFixed(2)}ms`);
      // Clean up the timer after it's ended
      delete this.timers[name];
    }
  },

  startPageLoad(name) {
    // Clear any existing page load timer for this page
    if (this.pageLoads[name]) {
      delete this.pageLoads[name];
    }
    this.pageLoads[name] = {
      start: performance.now(),
      end: null,
      duration: null
    };
    console.log(`[Performance] Started page load: ${name}`);
    return name; // Return the name for reference
  },

  endPageLoad(name) {
    if (this.pageLoads[name]) {
      this.pageLoads[name].end = performance.now();
      this.pageLoads[name].duration = this.pageLoads[name].end - this.pageLoads[name].start;
      console.log(`[Performance] Page ${name} loaded in ${this.pageLoads[name].duration.toFixed(2)}ms`);
      // Clean up the page load timer after it's ended
      delete this.pageLoads[name];
    }
  },

  getTimerDuration(name) {
    return this.timers[name]?.duration;
  },

  getPageLoadDuration(name) {
    return this.pageLoads[name]?.duration;
  },

  clearTimers() {
    this.timers = {};
  },

  clearPageLoads() {
    this.pageLoads = {};
  }
};

export default performanceMonitor; 