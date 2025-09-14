# Auto-Discovery of New OpenRouter Models

This document explains the automatic discovery system that monitors OpenRouter for new models and triggers benchmarks.

## Overview

The auto-discovery system automatically:
1. **Monitors OpenRouter**: Checks for new models every 6 hours
2. **Filters intelligently**: Only considers models not in `benchmark-config.json` or `untested-models.json`
3. **Triggers benchmarks**: Automatically runs the `benchmark-append` workflow for new models
4. **Creates notifications**: Generates GitHub issues for new model discoveries
5. **Mentions @alrocar**: Ensures you're notified of new models

## How It Works

### 1. Scheduled Monitoring
- **Frequency**: Every 6 hours via cron schedule
- **Manual trigger**: Can be run manually with dry-run option
- **Smart filtering**: Only processes truly new models

### 2. Model Classification
The system classifies OpenRouter models into three categories:

- **✅ Tested**: Models in `benchmark-config.json` (have results)
- **⏸️ Untested**: Models in `untested-models.json` (known but not tested)
- **🆕 New**: Models not in either list (truly new discoveries)

### 3. Automatic Benchmarking
When new models are found:
1. Triggers `benchmark-append.yml` workflow for each new model
2. Creates individual PRs with benchmark results
3. Updates `benchmark-config.json` automatically
4. Mentions @alrocar in each PR

## Workflow Files

### `auto-discover-models.yml`
Main workflow that:
- Runs every 6 hours
- Checks for new models
- Triggers benchmarks
- Creates summary issues

### `benchmark-append.yml`
Existing workflow that:
- Runs benchmarks for specific models
- Creates PRs with results
- Mentions @alrocar

## Usage

### Automatic Operation
The system runs automatically every 6 hours. No manual intervention required.

### Manual Trigger
```bash
# Go to GitHub Actions → "Auto-discover new OpenRouter models"
# Click "Run workflow"
# Choose dry-run mode to test without running benchmarks
```

### Local Testing
```bash
cd src
npm run check-new-models  # Check for new models locally
```

## Configuration

### Schedule
Current schedule: `0 */6 * * *` (every 6 hours)
- Can be modified in the workflow file
- Consider rate limits and OpenRouter API usage

### Dry Run Mode
Available when manually triggering:
- Shows what would be benchmarked
- Doesn't actually run benchmarks
- Useful for testing

## Outputs

### GitHub Issues
When new models are found, creates issues with:
- List of new models by provider
- Count of new models
- Status of benchmark triggers
- Labels: `auto-discovery`, `new-models`

### Pull Requests
For each new model:
- Individual PR with benchmark results
- Updated `benchmark-config.json`
- @alrocar mention for notification

### Files Generated
- `new-models.json`: List of newly discovered models
- `benchmark-new-models.sh`: Script to run benchmarks locally

## Current Status

As of the last check:
- **Total OpenRouter models**: 331
- **Tested models**: 54
- **Untested models**: 280
- **New models**: 0 (all models accounted for)

## Monitoring

### Success Indicators
- ✅ No new models found (all models accounted for)
- ✅ New models discovered and benchmarked
- ✅ PRs created with results
- ✅ @alrocar mentioned in PRs

### Failure Scenarios
- ❌ OpenRouter API unavailable
- ❌ GitHub API rate limits
- ❌ Benchmark failures for specific models
- ❌ Workflow trigger failures

## Troubleshooting

### Common Issues

1. **No new models found**
   - This is normal when all models are accounted for
   - Check the status summary in the workflow logs

2. **API rate limits**
   - The workflow includes delays between triggers
   - Consider reducing frequency if needed

3. **Benchmark failures**
   - Some models may not support the required format
   - Individual failures don't stop the process

4. **Workflow trigger failures**
   - Check GitHub token permissions
   - Verify workflow file syntax

### Manual Recovery
If the auto-discovery fails:
1. Run `npm run check-new-models` locally
2. Manually trigger `benchmark-append.yml` for specific models
3. Check GitHub Actions logs for error details

## Integration

This system integrates with:
- **Existing benchmark infrastructure**
- **GitHub Actions workflows**
- **PR creation and notification system**
- **Configuration management**

The auto-discovery system maintains full backward compatibility while adding intelligent monitoring capabilities.
