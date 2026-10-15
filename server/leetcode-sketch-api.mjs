import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const leetcodeSketchDatasetPath = path.join(
  projectRoot,
  'data',
  'processed',
  'leetcode-sketch-problems-v1.json',
)

let leetcodeSketchDatasetPromise

const loadLeetCodeSketchDataset = () => {
  if (!leetcodeSketchDatasetPromise) {
    leetcodeSketchDatasetPromise = readFile(leetcodeSketchDatasetPath, 'utf8')
      .then((contents) => JSON.parse(contents))
      .then((dataset) => {
        if (
          !dataset ||
          dataset.dataset !== 'leetcode-sketch' ||
          (dataset.schemaVersion !== 1 && dataset.schemaVersion !== 2) ||
          !dataset.problems ||
          typeof dataset.problems !== 'object' ||
          Array.isArray(dataset.problems)
        ) {
          throw new Error('LeetCode Sketch dataset has an unsupported format')
        }
        return dataset
      })
      .catch((error) => {
        leetcodeSketchDatasetPromise = undefined
        throw error
      })
  }
  return leetcodeSketchDatasetPromise
}

const sendJson = (response, status, body) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export const handleLeetCodeSketchApi = async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith('/api/')) return false

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed' })
    return true
  }

  const match = /^\/api\/leetcode-sketch\/problems\/(\d+)$/.exec(pathname)
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) {
    sendJson(response, 404, { error: 'API route not found' })
    return true
  }

  const problemId = match[1]
  try {
    const dataset = await loadLeetCodeSketchDataset()
    const problem = dataset.problems[problemId]
    if (
      !problem &&
      dataset.premiumProblems?.some((item) => String(item.questionId) === problemId)
    ) {
      sendJson(response, 404, {
        error: `Problem #${problemId} is premium-locked on LeetCode and is not available in this dataset.`,
      })
      return true
    }
    if (!problem) {
      sendJson(response, 404, {
        error: `LeetCode Sketch data for problem #${problemId} is not available.`,
      })
      return true
    }

    sendJson(response, 200, problem)
  } catch (error) {
    console.error('Unable to load LeetCode Sketch data:', error)
    sendJson(response, 500, { error: 'LeetCode Sketch data is temporarily unavailable.' })
  }
  return true
}
