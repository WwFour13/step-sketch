import assert from 'node:assert/strict'
import test from 'node:test'
import { handleLeetCodeSketchApi } from '../server/leetcode-sketch-api.mjs'

const requestApi = async (url, method = 'GET') => {
  const response = {
    headers: {},
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body = '') {
      this.body = body
    },
  }
  const handled = await handleLeetCodeSketchApi({ method, url }, response)
  return { handled, response }
}

test('returns only the requested LeetCode Sketch problem record', async () => {
  const { handled, response } = await requestApi('/api/leetcode-sketch/problems/1')
  const problem = JSON.parse(response.body)

  assert.equal(handled, true)
  assert.equal(response.statusCode, 200)
  assert.equal(problem.questionId, 1)
  assert.equal(problem.title, 'Two Sum')
  assert.equal(Array.isArray(problem.testCases), true)
  assert.equal(Object.hasOwn(problem, 'description'), false)
  assert.equal(Object.hasOwn(problem, 'exampleTestcases'), false)
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('returns not found when LeetCode Sketch data is unavailable', async () => {
  const { response } = await requestApi('/api/leetcode-sketch/problems/999999')

  assert.equal(response.statusCode, 404)
  assert.match(JSON.parse(response.body).error, /LeetCode Sketch data/)
})

test('rejects unsupported methods and unknown API routes', async () => {
  const methodResult = await requestApi('/api/leetcode-sketch/problems/1', 'POST')
  const routeResult = await requestApi('/api/leetcode-sketch/problems/not-a-number')
  const unqualifiedRouteResult = await requestApi('/api/problems/1')

  assert.equal(methodResult.response.statusCode, 405)
  assert.equal(methodResult.response.headers.Allow, 'GET')
  assert.equal(routeResult.response.statusCode, 404)
  assert.equal(unqualifiedRouteResult.response.statusCode, 404)
})

test('passes non-API requests to the next middleware', async () => {
  const { handled } = await requestApi('/')

  assert.equal(handled, false)
})
