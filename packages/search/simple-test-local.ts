import { handler } from './lambdas/search-indexed-transcripts.js';
import { log } from '@listen-fair-play/logging';

async function runTest() {
  // Example: Simulating an API Gateway GET request
  const getEvent = {
    httpMethod: 'GET',
    queryStringParameters: {
      query: 'listen, fair play',
      limit: '1000',
      fields: 'text',
      suggest: 'false',
      matchAllFields: 'false'
    }
  };

  // Example: Simulating a direct invocation or POST request with a JSON body
  const postEvent = {
    body: JSON.stringify({
      query: 'goalkeeper',
      limit: 3,
      searchFields: ['text'],
      suggest: true
    })
  };

  // Example: Simulating a direct invocation with a query property
  const directEvent = {
    query: 'goalkeeper',
    limit: 2,
    searchFields: ['text'],
    suggest: false,
    matchAllFields: true
  };

  try {
    log.info('Testing with GET event:');
    const getResult = await handler(getEvent);
    log.info('GET Test Results:', JSON.stringify(getResult, null, 2));

    log.info('\nTesting with POST event:');
    const postResult = await handler(postEvent);
    log.info('POST Test Results:', JSON.stringify(postResult, null, 2));
    
    log.info('\nTesting with direct event:');
    const directResult = await handler(directEvent);
    log.info('Direct Test Results:', JSON.stringify(directResult, null, 2));

  } catch (error) {
    log.error('Local test failed:', error);
  }
}

runTest(); 