// PDF Performance monitoring utility
const pdfPerformanceMonitor = {
  timers: {},
  stages: {},
  pdfGenerations: {},

  startTimer(name) {
    this.timers[name] = {
      start: performance.now(),
      end: null,
      duration: null
    };
    console.log(`[PDF Performance] Started timer: ${name}`);
  },

  endTimer(name) {
    if (this.timers[name]) {
      this.timers[name].end = performance.now();
      this.timers[name].duration = this.timers[name].end - this.timers[name].start;
      console.log(`[PDF Performance] Timer ${name} completed in ${this.timers[name].duration.toFixed(2)}ms`);
      // Clean up the timer after it's ended
      delete this.timers[name];
    }
  },

  startStage(stageName, pdfId = 'default') {
    if (!this.stages[pdfId]) {
      this.stages[pdfId] = {};
    }
    this.stages[pdfId][stageName] = {
      start: performance.now(),
      end: null,
      duration: null
    };
    console.log(`[PDF Performance] Started stage: ${stageName} for PDF ${pdfId}`);
  },

  endStage(stageName, pdfId = 'default') {
    if (this.stages[pdfId] && this.stages[pdfId][stageName]) {
      this.stages[pdfId][stageName].end = performance.now();
      this.stages[pdfId][stageName].duration = this.stages[pdfId][stageName].end - this.stages[pdfId][stageName].start;
      console.log(`[PDF Performance] Stage ${stageName} completed in ${this.stages[pdfId][stageName].duration.toFixed(2)}ms for PDF ${pdfId}`);
    }
  },

  startPDFGeneration(pdfId, pdfType, dataSize = 0) {
    this.pdfGenerations[pdfId] = {
      type: pdfType,
      start: performance.now(),
      end: null,
      duration: null,
      dataSize: dataSize,
      stages: {},
      totalStages: 0,
      completedStages: 0
    };
    console.log(`[PDF Performance] Started PDF generation: ${pdfType} (ID: ${pdfId}, Data size: ${dataSize} items)`);
    return pdfId;
  },

  endPDFGeneration(pdfId) {
    if (this.pdfGenerations[pdfId]) {
      this.pdfGenerations[pdfId].end = performance.now();
      this.pdfGenerations[pdfId].duration = this.pdfGenerations[pdfId].end - this.pdfGenerations[pdfId].start;
      
      // Calculate stage breakdown
      const stageBreakdown = Object.entries(this.stages[pdfId] || {})
        .map(([stageName, stage]) => ({
          stage: stageName,
          duration: stage.duration || 0
        }))
        .sort((a, b) => b.duration - a.duration);

      console.log(`[PDF Performance] PDF generation completed: ${this.pdfGenerations[pdfId].type} (ID: ${pdfId})`);
      console.log(`[PDF Performance] Total time: ${this.pdfGenerations[pdfId].duration.toFixed(2)}ms`);
      console.log(`[PDF Performance] Data size: ${this.pdfGenerations[pdfId].dataSize} items`);
      console.log(`[PDF Performance] Stage breakdown:`, stageBreakdown);
      
      // Log performance summary
      this.logPerformanceSummary(pdfId);
      
      // Clean up
      delete this.pdfGenerations[pdfId];
      delete this.stages[pdfId];
    }
  },

  logPerformanceSummary(pdfId) {
    const pdf = this.pdfGenerations[pdfId];
    if (!pdf) return;

    const totalTime = pdf.duration;
    const dataSize = pdf.dataSize;
    const timePerItem = dataSize > 0 ? totalTime / dataSize : 0;

    console.log(`[PDF Performance Summary] ==========================================`);
    console.log(`[PDF Performance Summary] Type: ${pdf.type}`);
    console.log(`[PDF Performance Summary] Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`[PDF Performance Summary] Data Items: ${dataSize}`);
    console.log(`[PDF Performance Summary] Time per Item: ${timePerItem.toFixed(2)}ms`);
    
    if (totalTime > 10000) {
      console.warn(`[PDF Performance Summary] ⚠️  Slow generation detected (>10s)`);
    } else if (totalTime > 5000) {
      console.warn(`[PDF Performance Summary] ⚠️  Moderate generation time (>5s)`);
    } else {
      console.log(`[PDF Performance Summary] ✅ Good performance (<5s)`);
    }
    console.log(`[PDF Performance Summary] ==========================================`);
  },

  getTimerDuration(name) {
    return this.timers[name]?.duration;
  },

  getStageDuration(stageName, pdfId = 'default') {
    return this.stages[pdfId]?.[stageName]?.duration;
  },

  getPDFGenerationDuration(pdfId) {
    return this.pdfGenerations[pdfId]?.duration;
  },

  clearTimers() {
    this.timers = {};
  },

  clearStages(pdfId = null) {
    if (pdfId) {
      delete this.stages[pdfId];
    } else {
      this.stages = {};
    }
  },

  clearPDFGenerations() {
    this.pdfGenerations = {};
  },

  // Utility method to track common PDF generation stages
  trackCommonStages(pdfId, pdfType, data) {
    const dataSize = data?.items?.length || data?.clearanceItems?.length || data?.assessmentItems?.length || 0;
    const generationId = this.startPDFGeneration(pdfId, pdfType, dataSize);

    // Track common stages
    this.startStage('data-preparation', generationId);
    this.startStage('template-loading', generationId);
    this.startStage('html-generation', generationId);
    this.startStage('puppeteer-setup', generationId);
    this.startStage('pdf-rendering', generationId);
    this.startStage('compression', generationId);

    return generationId;
  }
};

export default pdfPerformanceMonitor; 