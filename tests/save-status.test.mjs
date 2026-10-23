import assert from 'node:assert/strict'
import test from 'node:test'
import { formatSaveStatus } from '../src/utils/canvasState.ts'

test('formatSaveStatus formats seconds < 5 with countdown', () => {
  const base = 1000000000000
  assert.equal(formatSaveStatus(base, base), 'Saved just now (0s)')
  assert.equal(formatSaveStatus(base, base + 999), 'Saved just now (0s)')
  assert.equal(formatSaveStatus(base, base + 1000), 'Saved just now (1s)')
  assert.equal(formatSaveStatus(base, base + 2500), 'Saved just now (2s)')
  assert.equal(formatSaveStatus(base, base + 3000), 'Saved just now (3s)')
  assert.equal(formatSaveStatus(base, base + 4999), 'Saved just now (4s)')
})

test('formatSaveStatus transitions to < 1m and minute/hour buckets', () => {
  const base = 1000000000000
  assert.equal(formatSaveStatus(base, base + 5000), 'Saved < 1m ago')
  assert.equal(formatSaveStatus(base, base + 59999), 'Saved < 1m ago')
  assert.equal(formatSaveStatus(base, base + 60000), 'Saved 1m ago')
  assert.equal(formatSaveStatus(base, base + 119999), 'Saved 1m ago')
  assert.equal(formatSaveStatus(base, base + 120000), 'Saved 2m ago')
  assert.equal(formatSaveStatus(base, base + 3600000), 'Saved 1h ago')
  assert.equal(formatSaveStatus(base, base + 7200000), 'Saved 2h ago')
})

