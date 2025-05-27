CURSOR-TODO: Fill out this doc - but don't actually implement anything - with a proposal for creating a configurable, scheduled trigger to keep our search lambda warm.

Likely approach: EventBridge, that runs once every 5-15 minutes, and calls a /health endpoint on the Lambda. It can be configured to be on or off by .env.dev variables when deploying.