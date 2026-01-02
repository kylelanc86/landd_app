# Reports Page Filtering Logic Explanation

## How It Works

The reports home page filters folders to show only those with **active jobs or reports**. Here's the flow:

### Frontend Flow (index.jsx)

1. **Fetch Valid Project IDs** (`fetchProjectsWithReportsOrActiveJobs`):
   - First checks cache (30-minute duration)
   - If cache miss, calls backend endpoint `/projects/with-reports-or-jobs/ids`
   - Returns a Set of project IDs that qualify

2. **Load Projects** (`loadInitialProjects`):
   - Gets valid project IDs from step 1
   - Filters cached projects to only include valid IDs
   - Fetches fresh project data for valid IDs
   - Displays only projects that match the valid IDs

### Backend Filtering Logic (backend/routes/projects.js)

The backend endpoint checks **10 different conditions** that qualify a project to appear. A project appears if it meets ANY of these conditions:

#### Active/In-Progress Items:
1. ✅ **Active air monitoring jobs** - Status: `in_progress`
2. ✅ **Active asbestos removal jobs** - Status: `in_progress`  
3. ✅ **Active client supplied jobs** - Status: `In Progress` or `Analysis Complete`

#### Completed Items with Reports:
4. ⚠️ **Completed asbestos removal jobs** - Status: `completed` (includes all completed)
5. ⚠️ **Completed client supplied jobs** - Status: `Completed` (includes all completed)
6. ✅ **Air monitoring jobs with shift reports** - Shifts with status: `analysis_complete` or `shift_complete`

#### Any Items (No Status Filter):
7. ⚠️ **Any asbestos assessments** - No status filter (includes all assessments)
8. ⚠️ **Clearance reports** - Status: `complete` or `Site Work Complete`
9. ⚠️ **Any uploaded reports** - All uploaded reports (includes all historical reports)

**Note:** Invoices were removed from the filter as they don't indicate active jobs or reports.

## Potential Causes of Folders Showing Without Active Jobs/Reports

If you're seeing folders that don't have active jobs or reports, they likely match one of these conditions:

### Most Likely Culprits:

1. **Historical Uploaded Reports (#9)**: Any project with uploaded reports will appear, regardless of:
   - Report age
   - Project status
   - Active work status

2. **Any Asbestos Assessments (#7)**: Projects with assessments show up even if:
   - The assessment is old
   - No active work is being done
   - No reports have been generated

3. **Completed Jobs (#4, #5, #6)**: Completed jobs are included, which means:
   - Old completed projects may still appear
   - Projects with only historical completed work will show

4. **Clearance Reports (#8)**: Projects with clearance reports appear if status is `complete` or `Site Work Complete`

### To Identify the Cause:

1. **Check browser console** for logging:
   - `[REPORTS] Found X projects with reports/jobs` - shows how many projects qualified
   - `[PROJECTS] Found X projects with reports/jobs in Xms` - backend log showing the count

2. **Clear the cache** and refresh to get fresh data:
   ```javascript
   // In browser console:
   localStorage.removeItem('reportsProjectIdsWithReportsOrJobs');
   // Then refresh the page
   ```

3. **Check browser console logs** - Detailed logging has been added:
   - `[REPORTS-FILTER]` logs show counts for each condition
   - `[REPORTS-FOLDER]` logs show which condition(s) matched each project folder
   - `[REPORTS] Projects count by reason` shows summary statistics

4. **Check a specific project** by examining what conditions it meets (see console logs for `[REPORTS-FOLDER]`):
   - Does it have uploaded reports? (Condition #9)
   - Does it have asbestos assessments? (Condition #7)
   - Does it have completed jobs? (Condition #4, #5, #6)
   - Does it have clearance reports? (Condition #8)

## Recommendations

If you want to show **only** projects with truly active work, consider modifying the backend endpoint to exclude:
- Old uploaded reports (or add date filters)
- Completed jobs (keep only active/in-progress) - though note completed jobs indicate reports exist
- Old assessments (or add date filters)

Alternatively, you could add a date filter to exclude items older than a certain threshold (e.g., 1 year, 2 years).

## Diagnostic Logging

The system now includes detailed logging to help identify why folders appear:

- **Backend logs** (`[REPORTS-FILTER]`): Shows counts for each condition checked
- **Frontend logs** (`[REPORTS-FOLDER]`): Shows which condition(s) matched each project folder
- **Summary logs**: Shows aggregate statistics by reason type

Check the browser console when loading the reports page to see detailed diagnostic information for each folder.
