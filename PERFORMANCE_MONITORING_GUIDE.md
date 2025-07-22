# Performance Monitoring System

## Overview

We've implemented a comprehensive performance monitoring system to help identify and resolve performance bottlenecks in the air monitoring application. The system includes both frontend and backend monitoring capabilities.

## Components

### 1. Frontend Performance Monitor (`frontend/src/utils/performanceMonitor.js`)

**Features:**
- Page load timing
- General timer functionality
- Automatic cleanup of completed timers
- Console logging with `[Performance]` prefix

**Usage:**
```javascript
import performanceMonitor from '../utils/performanceMonitor';

// Page load monitoring
performanceMonitor.startPageLoad('page-name');
// ... page loads ...
performanceMonitor.endPageLoad('page-name');

// General timing
performanceMonitor.startTimer('operation-name');
// ... operation ...
performanceMonitor.endTimer('operation-name');
```

### 2. PDF Performance Monitor (`frontend/src/utils/pdfPerformanceMonitor.js`)

**Features:**
- Specialized PDF generation timing
- Stage-based monitoring (data preparation, template loading, HTML generation, Puppeteer setup, PDF rendering, compression)
- Performance summaries with warnings for slow operations
- Data size tracking

**Usage:**
```javascript
import pdfPerformanceMonitor from '../utils/pdfPerformanceMonitor';

// Track common PDF generation stages
const generationId = pdfPerformanceMonitor.trackCommonStages(pdfId, 'pdf-type', data);

// Manual stage tracking
pdfPerformanceMonitor.startStage('custom-stage', generationId);
// ... stage work ...
pdfPerformanceMonitor.endStage('custom-stage', generationId);

// Complete PDF generation
pdfPerformanceMonitor.endPDFGeneration(generationId);
```

### 3. Backend Performance Monitor (in `backend/routes/pdf.js`)

**Features:**
- Server-side PDF generation timing
- Stage-based monitoring for backend operations
- Performance summaries with thresholds
- Integration with existing PDF generation functions

**Stages Monitored:**
- Data preparation
- Template loading
- Puppeteer setup
- HTML generation
- PDF rendering
- Compression
- Response preparation

### 4. Performance Monitor Dashboard (`frontend/src/components/PerformanceMonitor.jsx`)

**Features:**
- Real-time performance metrics display
- Expandable/collapsible interface
- Color-coded performance status (good/warning/critical)
- Clear data functionality
- Keyboard shortcut activation (SHIFT+P)

## Implementation Details

### Pages with Performance Monitoring

1. **Databases Page** (`frontend/src/scenes/databases/index.jsx`)
   - Page load timing
   - Database switching performance

2. **Clients Page** (`frontend/src/scenes/clients/index.jsx`)
   - Page load timing
   - User preferences loading
   - Search operations

3. **Invoices Page** (`frontend/src/scenes/invoices/index.jsx`)
   - Page load timing
   - Data fetching operations
   - Xero connection checks

4. **Projects Page** (already had monitoring)
   - Enhanced with additional timing

### PDF Generation Monitoring

**Frontend PDF Generation** (`frontend/src/utils/templatePDFGenerator.js`):
- API request timing
- Response processing
- Download preparation

**Backend PDF Generation** (`backend/routes/pdf.js`):
- Complete server-side process monitoring
- Stage-by-stage breakdown
- Performance thresholds and warnings

## Performance Thresholds

### Frontend
- **Good**: < 5 seconds
- **Warning**: 5-10 seconds
- **Critical**: > 10 seconds

### Backend PDF Generation
- **Good**: < 5 seconds
- **Warning**: 5-15 seconds
- **Critical**: > 15 seconds
- **Very Slow**: > 30 seconds

## Usage Instructions

### 1. Enable Performance Monitor

**Method 1: Keyboard Shortcut**
- Press `SHIFT + P` to toggle the performance monitor dashboard
- The dashboard appears in the bottom-right corner

**Method 2: Development Mode**
- The monitor is automatically available in development mode

### 2. Monitor Page Performance

Navigate between pages and watch the console for performance logs:
```
[Performance] Started page load: databases-page
[Performance] Page databases-page loaded in 1250.45ms
```

### 3. Monitor PDF Generation

Generate PDFs and watch for detailed performance breakdowns:
```
[PDF Performance] Started PDF generation: asbestos-clearance (ID: clearance-123, Data size: 15 items)
[PDF Performance] Stage data-preparation completed in 45.23ms for PDF clearance-123
[PDF Performance] Stage template-loading completed in 120.67ms for PDF clearance-123
[PDF Performance] Stage puppeteer-setup completed in 2345.12ms for PDF clearance-123
[PDF Performance] Stage html-generation completed in 567.89ms for PDF clearance-123
[PDF Performance] Stage pdf-rendering completed in 3456.78ms for PDF clearance-123
[PDF Performance] Stage compression completed in 23.45ms for PDF clearance-123
[PDF Performance] PDF generation completed: asbestos-clearance (ID: clearance-123)
[PDF Performance] Total time: 6658.14ms
[PDF Performance] Data size: 15 items
[PDF Performance] Stage breakdown: [
  { stage: 'pdf-rendering', duration: 3456.78 },
  { stage: 'puppeteer-setup', duration: 2345.12 },
  { stage: 'html-generation', duration: 567.89 },
  { stage: 'template-loading', duration: 120.67 },
  { stage: 'data-preparation', duration: 45.23 },
  { stage: 'compression', duration: 23.45 }
]
[PDF Performance Summary] ==========================================
[PDF Performance Summary] Type: asbestos-clearance
[PDF Performance Summary] Total Time: 6658.14ms
[PDF Performance Summary] Data Items: 15
[PDF Performance Summary] Time per Item: 443.88ms
[PDF Performance Summary] ⚠️  Moderate generation time (>5s)
[PDF Performance Summary] ==========================================
```

### 4. Backend Performance Monitoring

Server-side logs show similar detailed breakdowns:
```
[Backend Performance] Started timer: clearance-pdf-clearance-123
[Backend Performance] Started stage: data-preparation for PDF clearance-123
[Backend Performance] Stage data-preparation completed in 45ms for PDF clearance-123
[Backend Performance] Started stage: pdf-generation for PDF clearance-123
[Backend Performance] Stage pdf-generation completed in 6658ms for PDF clearance-123
[Backend Performance] Started stage: response-preparation for PDF clearance-123
[Backend Performance] Stage response-preparation completed in 23ms for PDF clearance-123
[Backend Performance] Timer clearance-pdf-clearance-123 completed in 6726ms
[Backend Performance Summary] ==========================================
[Backend Performance Summary] Type: asbestos-clearance
[Backend Performance Summary] Total Time: 6726ms
[Backend Performance Summary] Data Items: 15
[Backend Performance Summary] ⚠️  Moderate generation time (>5s)
[Backend Performance Summary] ==========================================
```

## Performance Optimization Recommendations

### Based on Monitoring Results

1. **Puppeteer Setup (2-3 seconds)**
   - Consider browser instance pooling
   - Optimize launch options
   - Use existing browser instances when possible

2. **PDF Rendering (3-4 seconds)**
   - Optimize HTML templates
   - Reduce image sizes
   - Consider server-side caching

3. **HTML Generation (0.5-1 second)**
   - Optimize template processing
   - Reduce DOM complexity
   - Minimize data transformations

4. **Data Preparation (< 0.1 second)**
   - Already optimized
   - No immediate concerns

## Troubleshooting

### Common Issues

1. **Performance Monitor Not Showing**
   - Ensure you're pressing `SHIFT + P` (not just `P`)
   - Check browser console for errors
   - Verify the component is imported correctly

2. **No Performance Data**
   - Navigate between pages to generate page load data
   - Generate PDFs to see PDF performance data
   - Check that monitoring is enabled in the target components

3. **Missing Backend Logs**
   - Ensure backend is running in development mode
   - Check server console for performance logs
   - Verify PDF generation routes are being called

### Debug Mode

To enable additional debugging, add to your environment:
```bash
# Frontend
REACT_APP_DEBUG_PERFORMANCE=true

# Backend
DEBUG_PERFORMANCE=true
```

## Future Enhancements

1. **Performance Analytics Dashboard**
   - Historical performance tracking
   - Trend analysis
   - Performance regression detection

2. **Automated Performance Testing**
   - CI/CD integration
   - Performance regression tests
   - Automated alerts for slow operations

3. **Advanced Metrics**
   - Memory usage tracking
   - Network request timing
   - Database query performance

4. **Performance Optimization Suggestions**
   - AI-powered recommendations
   - Automatic optimization suggestions
   - Performance best practices guidance

## Conclusion

This performance monitoring system provides comprehensive visibility into application performance, helping identify bottlenecks and optimize user experience. The system is designed to be non-intrusive in production while providing detailed insights during development and debugging. 