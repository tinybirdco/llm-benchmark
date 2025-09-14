# Failure Management System

This document explains how the system handles failed benchmarks and rejected models to prevent infinite retry loops.

## Problem Solved

Without this system, if a model fails to benchmark or you reject its PR, the auto-discovery would keep trying the same model repeatedly. This system prevents that by:

1. **Tracking failed models** - Models that fail during benchmarking
2. **Tracking rejected models** - Models whose PRs you close without merging
3. **Preventing re-processing** - These models are excluded from future auto-discovery runs

## How It Works

### 1. **Model Classification System**

Models are now classified into four categories:

- **✅ Tested**: Models in `benchmark-config.json` (successful benchmarks)
- **⏸️ Untested**: Models in `untested-models.json` (known but not tested)
- **❌ Failed**: Models in `failed-models.json` (benchmark failures)
- **🆕 New**: Models not in any of the above lists

### 2. **Failure Tracking**

#### **Benchmark Failures**
When a benchmark workflow fails:
1. Model is added to `failed-models.json`
2. Model is also added to `untested-models.json` (to prevent re-processing)
3. GitHub issue is created with failure details
4. @alrocar is mentioned for notification

#### **PR Rejections**
When you close a PR without merging:
1. `monitor-pr-closures.yml` workflow triggers
2. Model is added to `untested-models.json`
3. Comment is added to the closed PR
4. Summary issue is created

### 3. **Auto-Discovery Filtering**

The auto-discovery system now checks against:
- ✅ Tested models (`benchmark-config.json`)
- ⏸️ Untested models (`untested-models.json`)
- ❌ Failed models (`failed-models.json`)

Only models not in any of these lists are considered "new" and processed.

## Files Created

### `failed-models.json`
```json
{
  "generated_at": "2025-09-14T13:30:00.000Z",
  "total_count": 2,
  "models": [
    {
      "provider": "openrouter",
      "model": "sonoma-dusk-alpha",
      "modelId": "openrouter/sonoma-dusk-alpha",
      "reason": "Benchmark workflow failed",
      "failed_at": "2025-09-14T13:30:00.000Z",
      "attempt_count": 1
    }
  ]
}
```

### `untested-models.json` (Updated)
Now includes models that failed or were rejected:
```json
{
  "provider": "openrouter",
  "model": "sonoma-dusk-alpha",
  "modelId": "openrouter/sonoma-dusk-alpha",
  "reason": "Failed: Benchmark workflow failed",
  "failed_at": "2025-09-14T13:30:00.000Z"
}
```

## Management Commands

### **List Failed Models**
```bash
npm run manage-failed-models list
```

### **Add Failed Model**
```bash
npm run manage-failed-models add openrouter sonoma-dusk-alpha openrouter/sonoma-dusk-alpha "API error"
```

### **Remove Failed Model**
```bash
npm run manage-failed-models remove openrouter sonoma-dusk-alpha
```

### **Clear All Failed Models**
```bash
npm run manage-failed-models clear
```

## Workflow Integration

### **benchmark-append.yml**
- Detects benchmark failures
- Adds failed models to tracking lists
- Creates failure issues
- Mentions @alrocar

### **monitor-pr-closures.yml**
- Triggers when PRs are closed without merging
- Adds rejected models to untested list
- Comments on closed PRs
- Creates summary issues

### **auto-discover-models.yml**
- Checks against all three lists (tested, untested, failed)
- Only processes truly new models
- Prevents infinite retry loops

## User Workflow

### **When a Model Fails**
1. Benchmark workflow fails
2. Model is automatically added to failed list
3. GitHub issue is created with failure details
4. @alrocar is notified
5. Model won't be retried automatically

### **When You Reject a PR**
1. Close the PR without merging
2. `monitor-pr-closures.yml` triggers automatically
3. Model is added to untested list
4. Comment is added to the closed PR
5. Summary issue is created
6. Model won't be retried automatically

### **To Retry a Failed/Rejected Model**
1. Remove from failed list: `npm run manage-failed-models remove provider model`
2. Remove from untested list (if needed)
3. Model will be picked up by next auto-discovery run

## Benefits

### **Prevents Infinite Loops**
- Failed models are not retried automatically
- Rejected models are not retried automatically
- System learns from failures and rejections

### **Maintains Clean State**
- Clear separation between tested, untested, and failed models
- Easy to see what's been tried and what failed
- Simple management commands

### **User Control**
- You can easily retry models if you want
- Clear feedback on what happened and why
- GitHub issues provide audit trail

### **Automated Notifications**
- @alrocar is mentioned for all failures and rejections
- GitHub issues provide detailed information
- Comments on PRs explain what happened

## Monitoring

### **Check Current Status**
```bash
# See all failed models
npm run manage-failed-models list

# Check for new models (excludes failed/rejected)
npm run check-new-models
```

### **GitHub Issues**
Look for issues with these labels:
- `benchmark-failure` - Models that failed during benchmarking
- `model-rejected` - Models whose PRs were rejected
- `auto-generated` - All automatically created issues

### **PR Comments**
Closed PRs will have comments explaining:
- Why the model was added to untested list
- How to retry the model if desired
- Management commands for the model

## Best Practices

1. **Review Failed Models**: Check the failed models list periodically
2. **Clean Up**: Remove models from failed list if issues are resolved
3. **Monitor Issues**: Watch for benchmark-failure and model-rejected issues
4. **Retry Selectively**: Only retry models when you're confident they'll work
5. **Use Management Commands**: Use the provided commands to manage the lists

This system ensures that the auto-discovery process is efficient and doesn't waste resources on models that have already been tried and failed or rejected.
