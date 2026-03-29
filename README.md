# GitHub Issue Watcher

Polls `testfiesta/testfiesta-frontend` for new issues and POSTs them to a webhook.

## Setup

```bash
npm install
```

## Configure

Set environment variables before running:

```bash
export WEBHOOK_URL="https://your-webhook-url.com"
export GITHUB_TOKEN="ghp_yourtoken"   # optional but avoids rate limits (60 req/hr unauthenticated vs 5000 authenticated)
```

Or edit the defaults at the top of `watcher.ts` directly.

## Run

```bash
npm start
```

## Webhook Payload

Each new issue sends a POST with this JSON body:

```json
{
  "text": "🆕 New Issue on testfiesta/testfiesta-frontend: #42 — Bug in login flow",
  "issue_number": 42,
  "title": "Bug in login flow",
  "url": "https://github.com/testfiesta/testfiesta-frontend/issues/42",
  "author": "someuser",
  "body": "First 500 chars of the issue body...",
  "labels": ["bug"],
  "created_at": "2026-03-11T10:00:00Z"
}
```

## Notes

- On first run, existing issues are recorded but not sent to the webhook (to avoid spam).
- Seen issue IDs are persisted in `seen_issues.json` so restarts don't re-notify.
- Default poll interval: 60 seconds.

## Discord / Slack Webhooks

- The payload works out of the box with most webhook services.
- For Discord, change the `text` key to `content`.
- For Slack, the `text` field already matches the expected format.
