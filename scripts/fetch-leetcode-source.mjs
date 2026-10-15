import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutput = 'data/source/leetcode-problems-api.json'
const problemIndexUrl = 'https://leetcode.com/api/problems/all/'
const graphqlUrl = 'https://leetcode.com/graphql/'
const questionQuery = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      content
      exampleTestcases
    }
  }
`

const parseArgs = (args) => {
  const options = { output: defaultOutput, limit: 1000, retries: 3, delay: 250 }
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    const optionNames = {
      '--output': 'output',
      '--limit': 'limit',
      '--retries': 'retries',
      '--delay': 'delay',
    }
    const option = optionNames[key]
    if (!option || args[index + 1] === undefined) {
      throw new Error(`Unknown or incomplete option: ${key}`)
    }
    const value = args[++index]
    if (option === 'output') {
      options.output = value
      continue
    }
    const number = Number(value)
    const minimum = option === 'limit' ? 1 : 0
    if (!Number.isInteger(number) || number < minimum) {
      throw new Error(
        `--${option} must be a ${minimum === 1 ? 'positive' : 'non-negative'} integer`,
      )
    }
    options[option] = number
  }
  return options
}

const resolveFromRoot = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)

const readExistingSource = async (outputPath) => {
  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8'))
    if (!Array.isArray(parsed.problems)) {
      throw new Error(`Existing source file at ${outputPath} has no problems array`)
    }
    return {
      problems: parsed.problems,
      premiumProblems: Array.isArray(parsed.premiumProblems) ? parsed.premiumProblems : [],
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { problems: [], premiumProblems: [] }
    throw error
  }
}

const writeJsonAtomically = async (filePath, data) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, filePath)
}

const fetchWithRetries = async (url, init, retries) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, init)
      if (response.ok) return response
      const detail = (await response.text()).slice(0, 1000)
      const error = new Error(`LeetCode request failed (${response.status}): ${detail}`)
      if (attempt >= retries || (response.status !== 429 && response.status < 500)) throw error
    } catch (error) {
      if (attempt >= retries) throw error
      if (
        !(error instanceof TypeError) &&
        !/LeetCode request failed \((429|5\d\d)\)/.test(error.message)
      ) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
  }
}

const fetchQuestionIndex = async (retries) => {
  const response = await fetchWithRetries(problemIndexUrl, undefined, retries)
  const payload = await response.json()
  if (!Array.isArray(payload.stat_status_pairs)) {
    throw new Error('LeetCode returned an invalid problem index')
  }
  return payload.stat_status_pairs
    .map((entry) => ({
      questionId: Number(entry.stat.frontend_question_id),
      titleSlug: entry.stat.question__title_slug,
      paidOnly: entry.paid_only === true,
    }))
    .filter(
      (entry) =>
        Number.isInteger(entry.questionId) &&
        entry.questionId > 0 &&
        typeof entry.titleSlug === 'string' &&
        entry.titleSlug.length > 0,
    )
    .sort((a, b) => a.questionId - b.questionId)
}

const fetchProblem = async ({ questionId, titleSlug }, retries) => {
  const response = await fetchWithRetries(
    graphqlUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: questionQuery,
        variables: { titleSlug },
      }),
    },
    retries,
  )
  const payload = await response.json()
  const question = payload.data?.question
  if (!question) throw new Error(`LeetCode returned no question data for #${questionId}`)
  if (typeof question.content !== 'string' || typeof question.exampleTestcases !== 'string') {
    throw new Error(`LeetCode returned incomplete description or examples for #${questionId}`)
  }
  if (!question.exampleTestcases.trim()) {
    throw new Error(`LeetCode returned no example inputs for #${questionId}`)
  }
  return {
    questionId,
    title: question.title,
    titleSlug,
    description: question.content,
    exampleTestcases: question.exampleTestcases,
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const outputPath = resolveFromRoot(options.output)
  const [index, existingSource] = await Promise.all([
    fetchQuestionIndex(options.retries),
    readExistingSource(outputPath),
  ])
  const existingProblems = existingSource.problems
  const existingById = new Map(
    existingProblems.map((problem) => [String(problem.questionId), problem]),
  )
  const selected = index.slice(0, options.limit)
  const premiumProblems = selected
    .filter((problem) => problem.paidOnly)
    .map(({ questionId, titleSlug }) => ({ questionId, titleSlug }))
  const pending = selected.filter(
    (problem) => !problem.paidOnly && !existingById.has(String(problem.questionId)),
  )
  const failures = []

  console.log(
    `Fetching source for ${pending.length} problem(s); skipping ${premiumProblems.length} premium-only problem(s) and ${selected.length - pending.length - premiumProblems.length} already-present problem(s).`,
  )
  for (const problem of pending) {
    try {
      const source = await fetchProblem(problem, options.retries)
      existingById.set(String(problem.questionId), source)
      console.log(`Fetched #${problem.questionId}: ${source.title}`)
    } catch (error) {
      failures.push({
        questionId: problem.questionId,
        titleSlug: problem.titleSlug,
        error: error instanceof Error ? error.message : String(error),
      })
      console.error(
        `Failed #${problem.questionId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (options.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delay))
    }
  }

  const output = {
    source: 'leetcode.com',
    fetchedAt: new Date().toISOString(),
    premiumProblems: [
      ...new Map(
        [...existingSource.premiumProblems, ...premiumProblems].map((problem) => [
          String(problem.questionId),
          problem,
        ]),
      ).values(),
    ].sort((a, b) => a.questionId - b.questionId),
    problems: [...existingById.values()].sort((a, b) => a.questionId - b.questionId),
  }
  await writeJsonAtomically(outputPath, output)

  const errorPath = `${outputPath}.errors.json`
  if (failures.length > 0) {
    await writeJsonAtomically(errorPath, { failedAt: output.fetchedAt, failures })
    throw new Error(
      `${failures.length} problem(s) could not be fetched. Successful source records were saved; rerun to retry.`,
    )
  }

  try {
    await unlink(errorPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  console.log(`Saved ${output.problems.length} source record(s) to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
