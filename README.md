# LLM SQL Benchmark

A tool for benchmarking various Large Language Models (LLMs) on their ability to generate correct analytical SQL queries for Tinybird.

## Overview

This benchmark evaluates how well different LLMs can generate analytical SQL queries based on natural language questions about data in Tinybird. It measures:

- SQL query correctness
- Execution success
- Performance metrics (time to first token, total duration, token usage)
- Error handling and recovery

The benchmark includes an automated retry mechanism that feeds execution errors back to the model for correction.

## Features

- Test multiple LLM providers and models in a single run
- Configurable models and providers
- Automated error detection and retry
- Detailed performance metrics
- Results storage and analysis
- Parallel question processing for efficiency

## Supported Providers & Models

The benchmark currently supports the following providers and models through OpenRouter:

- **Anthropic**: Claude 3.5 Sonnet, Claude 3.7 Sonnet
- **DeepSeek**: DeepSeek Chat v3
- **Google**: Gemini 2.0 Flash, Gemini 2.5 Flash/Pro
- **Meta**: Llama 4 Maverick/Scout, Llama 3.3 70B
- **Mistral**: Ministral 8B, Mistral Small 3.1, Mistral Nemo
- **OpenAI**: GPT-4.1, GPT-4.1 Nano, GPT-4o Mini, O3/O4 Mini

## Prerequisites

- Node.js 18+ and npm
- OpenRouter API key
- Tinybird workspace token and API access

## Installation

1. Clone this repository
2. Install dependencies:

```bash
cd llm-benchmark/src
npm install
```

3. Prepare the Tinybird Workspace:

```bash
curl https://tinybird.co | sh
tb login
tb --cloud deploy
tb --cloud datasource append github_events https://storage.googleapis.com/dev-alrocar-public/github/01.parquet
```

3. Create a `.env` file with required credentials:

```
OPENROUTER_API_KEY=your_openrouter_api_key
TINYBIRD_WORKSPACE_TOKEN=your_tinybird_token
TINYBIRD_API_HOST=your_tinybird_api_host
```

## Usage

Run the benchmark:

```bash
npm run benchmark
```

This will:
1. Load the configured models from `benchmark-config.json`
2. Run each model against a set of predefined questions
3. Execute generated SQL queries against your Tinybird database
4. Store results in `benchmark/results.json`

## Configuration

Edit `benchmark-config.json` to customize which providers and models to test.

## Results Analysis

Results are saved in JSON format with detailed information about each query, including:
- Original question
- Generated SQL
- Execution results
- Performance metrics
- Error information (if any)
- Retry attempts

## Attribution

The GitHub dataset used in this benchmark is based on work by:

Milovidov A., 2020. Everything You Ever Wanted To Know About GitHub (But Were Afraid To Ask), https://ghe.clickhouse.tech/

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. You can propose changes, extend the documentation, and share ideas by creating pull requests and issues on the GitHub repository.

## License

This project is open-source and available under the [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) license or [Apache 2](https://www.apache.org/licenses/LICENSE-2.0) license. Attribution is required when using or adapting this content.
