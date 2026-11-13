import test from 'node:test';
import assert from 'node:assert/strict';

// Test search logic and fallback behaviors
import {
  defaultColleges,
  collegeNames,
  getColleges,
  searchColleges,
} from '../data/Colleges.ts';

test('Colleges catalog: defaultColleges is populated with > 1000 colleges', () => {
  assert.ok(defaultColleges.length >= 1000, `Expected > 1000 colleges, got ${defaultColleges.length}`);
  assert.ok(collegeNames.length >= 1000, `Expected > 1000 colleges in collegeNames, got ${collegeNames.length}`);
  assert.equal(getColleges().length, collegeNames.length);
});

test('Colleges catalog: contains Bennett University and Bennet University', () => {
  assert.ok(defaultColleges.includes('Bennett University'));
  assert.ok(defaultColleges.includes('Bennet University'));
  const searchResults = searchColleges('bennet');
  assert.ok(searchResults.length > 0, 'Expected search results for "bennet"');
  assert.ok(searchResults.includes('Bennett University'));
});

test('searchColleges: returns empty array for empty or whitespace query', () => {
  assert.deepEqual(searchColleges(''), []);
  assert.deepEqual(searchColleges('   '), []);
});

test('searchColleges: case-insensitive search finds matches', () => {
  const lowercaseResults = searchColleges('patel');
  const uppercaseResults = searchColleges('PATEL');
  assert.ok(lowercaseResults.length > 0, 'Expected matches for "patel"');
  assert.deepEqual(lowercaseResults, uppercaseResults, 'Search should be case-insensitive');
});

test('searchColleges: prioritizes prefix matches over substring matches', () => {
  const customList = [
    'National Institute of Technology',
    'Amrita School of Engineering',
    'Amity University',
    'Institute of Chemical Technology'
  ];

  const results = searchColleges('am', customList);
  assert.equal(results[0], 'Amity University');
  assert.equal(results[1], 'Amrita School of Engineering');
});

test('searchColleges: limits output to 15 results for UI responsiveness', () => {
  const results = searchColleges('college');
  assert.ok(results.length <= 15, `Expected max 15 results, got ${results.length}`);
});

test('searchColleges: returns empty array when no colleges match query', () => {
  const results = searchColleges('xyznonexistentcollege987654321');
  assert.deepEqual(results, []);
});
