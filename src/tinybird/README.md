
# Tinybird GitHub Events Analysis

## Tinybird

### Overview
This project analyzes GitHub events data to extract insights about repositories, users, and activity patterns. It demonstrates how to use Tinybird to process and analyze large volumes of GitHub event data.

### Data Sources

#### github_events
This data source contains GitHub events data including information about stars, forks, pull requests, issues, and more.

```bash
curl -X POST "https://api.us-east.aws.tinybird.co/v0/events?name=github_events" \
     -H "Authorization: Bearer $TB_ADMIN_TOKEN" \
     -d '{
       "file_time": "2023-01-01 12:00:00",
       "event_type": "WatchEvent",
       "actor_login": "user123",
       "repo_name": "organization/repository",
       "created_at": "2023-01-01 12:00:00",
       "updated_at": "2023-01-01 12:00:00",
       "action": "none",
       "comment_id": 0,
       "position": 0,
       "line": 0,
       "ref_type": "none",
       "number": 0,
       "state": "",
       "locked": 0,
       "comments": 0,
       "author_association": "NONE",
       "closed_at": "1970-01-01 00:00:00",
       "merged_at": "1970-01-01 00:00:00",
       "merge_commit_sha": "",
       "head_ref": "",
       "head_sha": "",
       "base_ref": "",
       "base_sha": "",
       "merged": 0,
       "mergeable": 0,
       "rebaseable": 0,
       "mergeable_state": "unknown",
       "merged_by": "",
       "review_comments": 0,
       "maintainer_can_modify": 0,
       "commits": 0,
       "additions": 0,
       "deletions": 0,
       "changed_files": 0,
       "diff_hunk": "",
       "original_position": 0,
       "commit_id": "",
       "original_commit_id": "",
       "push_size": 0,
       "push_distinct_size": 0,
       "member_login": "",
       "release_tag_name": "",
       "release_name": "",
       "review_state": "none"
     }'
```

#### results
This data source stores results from SQL queries, including metrics about LLM usage and performance.

```bash
curl -X POST "https://api.us-east.aws.tinybird.co/v0/events?name=results" \
     -H "Authorization: Bearer $TB_ADMIN_TOKEN" \
     -d '{
       "sql": "SELECT * FROM table",
       "sql_result_success": true,
       "sql_result_execution_time": 0.5,
       "sql_result_error": "",
       "sql_result_query_latency": 0.2,
       "sql_result_rows_read": 100,
       "sql_result_bytes_read": 1024,
       "name": "test_query",
       "question": "What is the most popular repository?",
       "model": "gpt-4",
       "provider": "openai",
       "llm_time_to_first_token": 0.1,
       "llm_total_duration": 2.5,
       "llm_prompt_tokens": 100,
       "llm_completion_tokens": 50,
       "llm_total_tokens": 150,
       "llm_error": ""
     }'
```

### Endpoints

#### Top Repositories by Stars
Get the top 10 repositories with the most stars.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_02.json?token=$TB_ADMIN_TOKEN"
```

#### Top Users by Stars Given
Get the top 10 GitHub users who have given the most stars.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_07.json?token=$TB_ADMIN_TOKEN"
```

#### Star Trends Over Time
See how the total number of stars has changed over time.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_06.json?token=$TB_ADMIN_TOKEN"
```

#### Top Repositories by Issue Comments
Get the top 10 repositories with the most issue comments.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_37.json?token=$TB_ADMIN_TOKEN"
```

#### Repositories with Most Pull Request Contributors
Get the top 10 repositories with the most unique pull request contributors.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_24.json?token=$TB_ADMIN_TOKEN"
```

#### Most Popular Comments
Get the top 10 most repeated comments on GitHub.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_60.json?token=$TB_ADMIN_TOKEN"
```

#### Most Active Organizations
Get the top 10 organizations by community size.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/pipe_50.json?token=$TB_ADMIN_TOKEN"
```

#### Generic Average Endpoint
Calculate the average of any metric, grouped by any dimension, with optional filters.

```bash
curl -X GET "https://api.us-east.aws.tinybird.co/v0/pipes/generic_average_endpoint.json?token=$TB_ADMIN_TOKEN&metric=llm_total_tokens&group_by=model&provider=openai"
```

Parameters:
- `metric`: Column to average (default: llm_total_tokens)
- `group_by`: Column to group by (default: model)
- `model`: Optional filter by model
- `provider`: Optional filter by provider
- `name`: Optional filter by name
