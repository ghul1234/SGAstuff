// Test script to verify news fetching from all 50 states
// Run with: node test-news-fetch.js

import { newsFetcher } from './src/newsFetcher.js';
import { STATE_NEWS_SOURCES } from './src/newsSources.js';

async function testAllStates() {
  console.log('='.repeat(60));
  console.log('Testing News Fetch from All 50 States');
  console.log('='.repeat(60));
  console.log();

  const results = {
    success: [],
    failed: [],
    totalArticles: 0,
    statesWithArticles: 0
  };

  // Check if a specific state was provided as command line argument
  const specificState = process.argv[2];
  const stateIds = specificState ? [specificState.toUpperCase()] : Object.keys(STATE_NEWS_SOURCES);
  
  for (let i = 0; i < stateIds.length; i++) {
    const stateId = stateIds[i];
    const source = STATE_NEWS_SOURCES[stateId];
    
    process.stdout.write(`Testing ${stateId} (${source.name})... `);
    
    try {
      const articles = await newsFetcher.fetchStateNews(stateId);
      
      if (articles.length > 0) {
        results.success.push({
          stateId,
          name: source.name,
          articleCount: articles.length,
          sampleTitle: articles[0].title
        });
        results.totalArticles += articles.length;
        results.statesWithArticles++;
        console.log(`✓ SUCCESS (${articles.length} articles)`);
        console.log(`  Sample: "${articles[0].title.substring(0, 60)}..."`);
        if (articles[0].description) {
          console.log(`  Description: "${articles[0].description.substring(0, 80)}..."`);
        }
      } else {
        results.failed.push({
          stateId,
          name: source.name,
          reason: 'No articles found'
        });
        console.log(`✗ FAILED (No articles found)`);
      }
    } catch (error) {
      results.failed.push({
        stateId,
        name: source.name,
        reason: error.message
      });
      console.log(`✗ FAILED (${error.message})`);
    }
    
    // Small delay to avoid overwhelming the proxies
    if (i < stateIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total States Tested: ${stateIds.length}`);
  console.log(`States with Articles: ${results.statesWithArticles} (${((results.statesWithArticles / stateIds.length) * 100).toFixed(1)}%)`);
  console.log(`Total Articles Retrieved: ${results.totalArticles}`);
  console.log(`Average Articles per State: ${(results.totalArticles / Math.max(results.statesWithArticles, 1)).toFixed(1)}`);
  console.log();

  if (results.success.length > 0) {
    console.log('SUCCESSFUL STATES:');
    console.log('-'.repeat(60));
    results.success.forEach(result => {
      console.log(`  ${result.stateId} - ${result.name}: ${result.articleCount} articles`);
    });
    console.log();
  }

  if (results.failed.length > 0) {
    console.log('FAILED STATES:');
    console.log('-'.repeat(60));
    results.failed.forEach(result => {
      console.log(`  ${result.stateId} - ${result.name}: ${result.reason}`);
    });
    console.log();
  }

  console.log('='.repeat(60));
  
  // Return exit code based on success rate
  const successRate = results.statesWithArticles / stateIds.length;
  if (successRate >= 0.8) {
    console.log('✓ EXCELLENT: 80%+ states working');
    process.exit(0);
  } else if (successRate >= 0.5) {
    console.log('⚠ MODERATE: 50-80% states working');
    process.exit(1);
  } else {
    console.log('✗ POOR: Less than 50% states working');
    process.exit(2);
  }
}

// Run the test
testAllStates().catch(error => {
  console.error('Test script error:', error);
  process.exit(3);
});
