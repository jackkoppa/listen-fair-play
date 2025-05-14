> [!NOTE]  
> See [/diagrams](../../../diagrams/README.md) for details on how these Lambdas interact when deployed

* [lambda-4](./lambda-4/) - search-indexed-transcripts.ts

---

This directory contains the AWS Lambda function responsible for searching indexed podcast transcripts.

## How it Works

The Lambda function (`search/lambdas/search-indexed-transcripts.ts`) uses FlexSearch to perform searches. On cold starts, it loads a pre-built FlexSearch index from an S3 bucket. The index generation process is detailed in `/processing/convert-srt-files-into-search-entries.ts`.

The Lambda can be invoked via API Gateway (handling GET requests with query parameters) or directly (handling POST requests with a JSON body or an event object with a `query` property).

## Local Testing

To test the search Lambda locally, you can use the provided test script. This script simulates different invocation methods.

1.  **Ensure dependencies are installed:**
    ```bash
    npm install
    ```
2.  **Run the local test script:**
    ```bash
    npm run test:local
    ```
    or
    ```bash
    npm run run-search:local
    ```

This will execute `search/local-test.ts`, which calls the Lambda handler with predefined test events and logs the results.

## Calling the Lambda

The Lambda expects an event object that can take a few forms:

### 1. API Gateway GET Request (example)

```json
{
  "httpMethod": "GET",
  "queryStringParameters": {
    "query": "search term",
    "limit": "10", // Optional, default is 10
    "fields": "text,episodeTitle", // Optional, default is 'text'. Comma-separated list of fields to search.
    "suggest": "false", // Optional, default is false. Set to 'true' for suggestions.
    "matchAllFields": "false" // Optional, default is false. Set to 'true' to match all specified fields.
  }
}
```

### 2. Direct Invocation / POST Request with JSON Body (example)

```json
{
  "body": {
    "query": "search term",
    "limit": 10, // Optional, default is 10
    "searchFields": ["text", "episodeTitle"], // Optional, default is ["text"]
    "suggest": false, // Optional, default is false
    "matchAllFields": false // Optional, default is false
  }
}
```

### 3. Direct Invocation with `query` property (example)

```json
{
  "query": "search term",
  "limit": 10, // Optional, default is 10
  "searchFields": ["text"], // Optional, default is ["text"]
  "suggest": false, // Optional, default is false
  "matchAllFields": false // Optional, default is false
}
```

### Search Parameters:

*   `query` (string, required): The search term.
*   `limit` (number, optional): Maximum number of results to return. Defaults to 10.
*   `searchFields` (string[] or comma-separated string, optional): Fields to search within. Defaults to `["text"]` or `"text"`. Valid fields are `text` and `episodeTitle`.
*   `suggest` (boolean, optional): Whether to enable spelling correction/suggestions. Defaults to `false`.
*   `matchAllFields` (boolean, optional): If `true`, results must match the query in *all* specified `searchFields`. If `false` (default), results can match in *any* of the specified `searchFields`.

## Client Integration

The `/client` React app should call the API Gateway endpoint that triggers this Lambda, passing the search parameters as described above (typically as query string parameters for a GET request).