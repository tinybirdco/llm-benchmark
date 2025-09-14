# Batch Benchmark for Untested OpenRouter Models

This document explains how to use the new batch benchmarking functionality to test all untested models from [OpenRouter](https://openrouter.ai/models).

## Overview

The system now automatically:
1. Fetches all available models from OpenRouter API
2. Compares them with your current `benchmark-config.json`
3. Identifies untested models
4. Provides multiple ways to run benchmarks for these models

## Quick Start

### 1. Find Untested Models

```bash
cd src
npm run fetch-models
```

This will:
- Fetch all models from OpenRouter API
- Compare with your current config
- Generate `untested-models.json` with the list
- Generate `benchmark-untested-models.sh` batch script
- Display a summary of untested models by provider

### 2. Run Batch Benchmarks

#### Option A: Local Batch Script
```bash
chmod +x benchmark-untested-models.sh
./benchmark-untested-models.sh
```

#### Option B: GitHub Actions (Recommended)
1. Go to the GitHub Actions tab
2. Run the "Batch benchmark untested models" workflow
3. Configure parameters:
   - `max_models`: Number of models to test (default: 10)
   - `start_from`: Starting index for pagination (default: 0)

#### Option C: Individual Model Testing
```bash
npm run benchmark -- --model="provider/model-name"
```

## GitHub Actions Workflow

The new `benchmark-batch.yml` workflow provides:

- **Automatic model discovery**: Fetches latest models from OpenRouter
- **Configurable batch size**: Test 1-50+ models per run
- **Pagination support**: Process models in chunks
- **Automatic PR creation**: Results are submitted as PRs
- **Error handling**: Continues even if individual models fail
- **@alrocar mentions**: You'll be notified of new results

### Workflow Parameters

- `max_models`: Maximum number of models to benchmark (default: 10)
- `start_from`: Starting index for pagination (default: 0)

### Example Usage

1. **First batch**: Run with default settings (10 models)
2. **Continue**: Run with `start_from=10` to get next 10 models
3. **Large batch**: Set `max_models=50` for bigger batches

## Generated Files

### `untested-models.json`
```json
{
  "generated_at": "2025-09-14T13:11:40.339Z",
  "total_count": 280,
  "models": [
    {
      "provider": "qwen",
      "model": "qwen-plus-2025-07-28",
      "modelId": "qwen/qwen-plus-2025-07-28"
    }
  ]
}
```

### `benchmark-untested-models.sh`
A bash script that runs benchmarks for all untested models with:
- Progress indicators
- Error handling
- Automatic delays between runs
- Success/failure reporting

## Current Status

As of the last run, there are **280 untested models** across multiple providers:

- **qwen**: 31 models
- **openai**: 29 models  
- **mistralai**: 27 models
- **google**: 22 models
- **meta-llama**: 19 models
- **deepseek**: 16 models
- And many more providers...

## Best Practices

1. **Start small**: Begin with 5-10 models to test the workflow
2. **Monitor results**: Check PRs for any issues or patterns
3. **Use pagination**: Process models in batches to avoid timeouts
4. **Review failures**: Some models may not be suitable for SQL generation
5. **Update config**: The system automatically updates `benchmark-config.json`

## Troubleshooting

### Common Issues

1. **API Rate Limits**: The script includes delays between requests
2. **Model Failures**: Some models may not support the required format
3. **Provider Issues**: New providers are automatically added to config
4. **Timeout**: Use smaller batch sizes for large runs

### Manual Recovery

If a batch fails partway through:
1. Check the last successful model in the PR
2. Use `start_from` parameter to resume from that point
3. Adjust `max_models` if needed

## Integration with Existing Workflow

This batch system integrates seamlessly with:
- Individual model testing (`--model` parameter)
- Existing GitHub Actions
- Current benchmark infrastructure
- Result validation and PR creation

The system maintains backward compatibility while adding powerful batch capabilities.
