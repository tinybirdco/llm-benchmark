# Manual Execution Guide for Auto-Discovery

This guide explains how to manually run the auto-discovery workflow for new OpenRouter models.

## How to Run Manually

### 1. Navigate to GitHub Actions
1. Go to your repository on GitHub
2. Click on the **"Actions"** tab
3. Find **"Auto-discover new OpenRouter models"** in the workflow list
4. Click on it

### 2. Run the Workflow
1. Click the **"Run workflow"** button (top right)
2. Select the branch (usually `main`)
3. Configure the parameters (see below)
4. Click **"Run workflow"**

## Configuration Parameters

### 🔍 **Dry Run Mode**
- **Purpose**: Test the workflow without actually running benchmarks
- **Default**: `false`
- **When to use**: 
  - Testing the workflow
  - Checking what models would be discovered
  - Verifying the system works

### 📊 **Max Models**
- **Purpose**: Limit the number of new models to benchmark
- **Default**: `0` (no limit)
- **When to use**:
  - Testing with a small batch (e.g., `5`)
  - Avoiding overwhelming the system
  - Gradual rollout of new models

### 🚀 **Force Run**
- **Purpose**: Create an issue even when no new models are found
- **Default**: `false`
- **When to use**:
  - Testing the workflow
  - Getting a status report
  - Verifying the system is working

## Common Use Cases

### 🧪 **Testing the Workflow**
```
Dry Run: ✅ true
Max Models: 0
Force Run: ✅ true
```
**Result**: Creates an issue showing current status without running benchmarks

### 🔍 **Check for New Models**
```
Dry Run: ✅ true
Max Models: 0
Force Run: ❌ false
```
**Result**: Shows if any new models exist, no benchmarks run

### 🚀 **Run Small Batch**
```
Dry Run: ❌ false
Max Models: 5
Force Run: ❌ false
```
**Result**: Benchmarks up to 5 new models (if any exist)

### 🎯 **Full Discovery Run**
```
Dry Run: ❌ false
Max Models: 0
Force Run: ❌ false
```
**Result**: Benchmarks all new models found

## What Happens When You Run

### 1. **Discovery Phase**
- Fetches all models from OpenRouter API
- Compares with `benchmark-config.json` and `untested-models.json`
- Identifies truly new models

### 2. **Benchmark Phase** (if not dry run)
- Triggers `benchmark-append.yml` for each new model
- Creates individual PRs with results
- Mentions @alrocar in each PR

### 3. **Notification Phase**
- Creates a GitHub issue with summary
- Includes list of new models found
- Shows run configuration and results

## Expected Outputs

### ✅ **When New Models Found**
- **Issue created**: Lists all new models by provider
- **PRs created**: One per new model with benchmark results
- **@alrocar mentioned**: In each PR for notification

### 📊 **When No New Models Found**
- **Issue created** (if Force Run enabled): Shows current status
- **No PRs created**: All models already accounted for
- **Status summary**: Shows tested vs untested counts

### ❌ **When Errors Occur**
- **Workflow fails**: Check the Actions tab for error details
- **Individual model failures**: Workflow continues with other models
- **API issues**: May need to retry later

## Monitoring Results

### 1. **Check GitHub Issues**
- Look for issues with `auto-discovery` label
- Check for `manual-run` label for manual executions

### 2. **Check Pull Requests**
- Look for PRs with benchmark results
- Verify @alrocar mentions

### 3. **Check Workflow Logs**
- Go to Actions tab → Click on the workflow run
- Review logs for any errors or issues

## Troubleshooting

### **Workflow Won't Start**
- Check GitHub token permissions
- Verify workflow file syntax
- Ensure you're on the correct branch

### **No New Models Found**
- This is normal - all models may be accounted for
- Use Force Run to get a status report
- Check the logs for discovery details

### **Benchmarks Fail**
- Some models may not support the required format
- Check individual PR logs for specific errors
- The workflow continues even if some models fail

### **Rate Limits**
- The workflow includes delays between triggers
- Consider using Max Models to limit batch size
- Wait and retry if GitHub API limits are hit

## Best Practices

1. **Start with Dry Run**: Always test with dry run first
2. **Use Small Batches**: Start with Max Models = 5 for testing
3. **Monitor Results**: Check issues and PRs after running
4. **Check Logs**: Review workflow logs for any issues
5. **Gradual Rollout**: Use Max Models to control batch size

## Integration with Scheduled Runs

- **Manual runs** don't interfere with scheduled runs
- **Scheduled runs** happen every 6 hours automatically
- **Both** create issues and PRs as needed
- **Parameters** only apply to manual runs (scheduled runs use defaults)
