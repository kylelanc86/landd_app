# Branch Sync Guide

This guide explains how to sync changes between the `main` branch (production) and `development` branch.

## Prerequisites

- Git installed and configured
- Access to the repository
- Your local repository is up to date

## Table of Contents

1. [Syncing Main → Development](#syncing-main--development)
2. [Syncing Development → Main](#syncing-development--main)
3. [Best Practices](#best-practices)
4. [Common Scenarios](#common-scenarios)
5. [Troubleshooting](#troubleshooting)

---

## Syncing Main → Development

Use this when you want to bring production changes into the development branch.

### Step 1: Ensure you're on the development branch

```bash
git checkout development
```

### Step 2: Fetch latest changes from remote

```bash
git fetch origin
```

### Step 3: Merge main into development

```bash
git merge origin/main
```

**Alternative: Use rebase (cleaner history)**

```bash
git rebase origin/main
```

### Step 4: Resolve any conflicts (if any)

If conflicts occur:
1. Git will mark conflicted files
2. Open each file and resolve conflicts manually
3. After resolving, stage the files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the merge/rebase:
   - For merge: `git commit`
   - For rebase: `git rebase --continue`

### Step 5: Push to remote development branch

```bash
git push origin development
```

**If you used rebase and already pushed before:**

```bash
git push origin development --force-with-lease
```

> ⚠️ **Warning**: `--force-with-lease` is safer than `--force` as it prevents overwriting others' work.

---

## Syncing Development → Main

Use this when you want to deploy development changes to production.

### Step 1: Ensure development branch is up to date

```bash
git checkout development
git pull origin development
```

### Step 2: Switch to main branch

```bash
git checkout main
```

### Step 3: Fetch latest changes

```bash
git fetch origin
```

### Step 4: Merge development into main

```bash
git merge origin/development
```

**Alternative: Use rebase (cleaner history)**

```bash
git rebase origin/development
```

### Step 5: Resolve any conflicts (if any)

Same process as above - resolve conflicts, stage files, and continue.

### Step 6: Push to remote main branch

```bash
git push origin main
```

**If you used rebase and already pushed before:**

```bash
git push origin main --force-with-lease
```

---

## Best Practices

### 1. Always Pull Before Merging

Before merging, ensure both branches are up to date:

```bash
git checkout <branch-name>
git pull origin <branch-name>
```

### 2. Test Before Merging to Main

- Always test changes in development before merging to main
- Run your test suite if available
- Verify the app works in the development environment

### 3. Use Meaningful Commit Messages

When resolving conflicts or making final commits:

```bash
git commit -m "Merge main into development: sync production changes"
```

### 4. Keep Branches in Sync Regularly

Don't let branches drift too far apart. Regular syncing prevents large conflicts.

### 5. Review Changes Before Pushing

Use `git log` to review what you're about to merge:

```bash
# See commits in development that aren't in main
git log main..development

# See commits in main that aren't in development
git log development..main
```

---

## Common Scenarios

### Scenario 1: Quick Sync (No Conflicts)

**Main → Development:**
```bash
git checkout development
git fetch origin
git merge origin/main
git push origin development
```

**Development → Main:**
```bash
git checkout main
git fetch origin
git merge origin/development
git push origin main
```

### Scenario 2: You Have Uncommitted Changes

**Option A: Commit your changes first**
```bash
git add .
git commit -m "Your commit message"
# Then proceed with merge
```

**Option B: Stash your changes**
```bash
git stash
# Proceed with merge
git stash pop  # Restore your changes after merge
```

### Scenario 3: You Want to Preview Changes First

```bash
# See what would change without actually merging
git checkout development
git fetch origin
git diff development origin/main

# If satisfied, proceed with merge
git merge origin/main
```

### Scenario 4: Undo a Merge (Before Pushing)

If you merged but haven't pushed yet:

```bash
git merge --abort  # For merge
git rebase --abort  # For rebase
```

### Scenario 5: Create a Backup Branch

Before syncing, create a backup:

```bash
git checkout development
git branch development-backup-$(date +%Y%m%d)
# Now proceed with merge
```

---

## Troubleshooting

### Problem: "Your branch is behind 'origin/development'"

**Solution:**
```bash
git pull origin development
```

### Problem: Merge conflicts

**Solution:**
1. Identify conflicted files: `git status`
2. Open each file and look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Incoming changes
   >>>>>>> origin/main
   ```
3. Edit to resolve conflicts
4. Stage resolved files: `git add <file>`
5. Complete merge: `git commit` or `git rebase --continue`

### Problem: "Updates were rejected because the remote contains work"

**Solution:**
```bash
git pull origin <branch-name>
# Resolve any conflicts
git push origin <branch-name>
```

### Problem: Accidentally merged wrong direction

**Solution:**
If you haven't pushed yet:
```bash
git reset --hard HEAD~1  # Undo last commit (merge)
```

If you already pushed:
```bash
git revert -m 1 <merge-commit-hash>
git push origin <branch-name>
```

### Problem: Want to see what changed

**Solution:**
```bash
# See all differences
git diff main development

# See file list that changed
git diff --name-only main development

# See commit log differences
git log main..development --oneline
```

---

## Quick Reference Commands

### Check Current Branch
```bash
git branch
# or
git status
```

### See All Branches (Local and Remote)
```bash
git branch -a
```

### See Commit History
```bash
git log --oneline --graph --all
```

### Check for Uncommitted Changes
```bash
git status
```

### Discard Local Changes (⚠️ Destructive)
```bash
git reset --hard HEAD
```

---

## Workflow Summary

### Regular Development Workflow

1. Work on `development` branch
2. Test in development environment
3. When ready for production:
   - Sync any main changes into development first
   - Resolve conflicts
   - Test again
   - Merge development → main
   - Deploy to production

### Hotfix Workflow

1. Create hotfix from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/fix-name
   ```
2. Make fixes and commit
3. Merge hotfix to both branches:
   ```bash
   git checkout main
   git merge hotfix/fix-name
   git push origin main
   
   git checkout development
   git merge hotfix/fix-name
   git push origin development
   ```

---

## Notes

- **Never force push to main** unless absolutely necessary and you understand the consequences
- Always test in development before merging to main
- Keep environment variables in sync with branch deployments
- Document any manual configuration changes needed when switching branches

---

## Environment Variables Reminder

Remember to set the correct environment variables for each deployment:

**Development Branch:**
- `FRONTEND_URL` = `https://plankton-app-npflt.ondigitalocean.app`
- `REACT_APP_API_URL` = `https://plankton-app-npflt.ondigitalocean.app/api`

**Main Branch:**
- `FRONTEND_URL` = `https://app.landd.com.au`
- `REACT_APP_API_URL` = `https://app.landd.com.au/api`

These should be configured in your deployment platform (DigitalOcean App Platform) settings.

