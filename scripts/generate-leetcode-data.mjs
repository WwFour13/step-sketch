import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const promptPath = fileURLToPath(new URL('./leetcode-data-prompt.md', import.meta.url))
const defaults = {
  input: 'data/source/leetcode-problems.json',
  output: 'public/data/leetcode-problems-v1.json',
  concurrency: 2,
  limit: Infinity,
  ids: null,
  retries: 3,
  force: false,
}
const inputShapes = new Set([
  'scalar',
  'string',
  'array',
  'array_of_strings',
  'matrix',
  'array_of_arrays',
  'linked_list',
  'list_of_linked_lists',
  'binary_tree',
  'graph_adjacency_list',
  'graph_edge_list',
  'interval_list',
])

const parseArgs = (args) => {
  const options = { ...defaults }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--force') {
      options.force = true
      continue
    }
    const values = {
      '--input': 'input',
      '--output': 'output',
      '--concurrency': 'concurrency',
      '--limit': 'limit',
      '--ids': 'ids',
      '--retries': 'retries',
    }
    const key = values[arg]
    if (!key || args[index + 1] === undefined) {
      throw new Error(`Unknown or incomplete option: ${arg}`)
    }
    const value = args[++index]
    if (key === 'input' || key === 'output') {
      options[key] = value
    } else if (key === 'ids') {
      const ids = value.split(',').map((id) => id.trim())
      if (
        ids.some((id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)
      ) {
        throw new Error('--ids must be a comma-separated list of positive problem numbers')
      }
      if (new Set(ids).size !== ids.length) {
        throw new Error('--ids cannot contain duplicate problem numbers')
      }
      options.ids = ids.map(Number)
    } else {
      const number = Number(value)
      const minimum = key === 'limit' || key === 'concurrency' ? 1 : 0
      if (!Number.isInteger(number) || number < minimum) {
        throw new Error(`--${key} must be a ${minimum === 1 ? 'positive' : 'non-negative'} integer`)
      }
      options[key] = number
    }
  }
  return options
}

const resolveFromRoot = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)

const readSourceProblems = async (inputPath) => {
  const parsed = JSON.parse(await readFile(inputPath, 'utf8'))
  const problems = Array.isArray(parsed) ? parsed : parsed.problems
  if (!Array.isArray(problems)) {
    throw new Error('Input JSON must be an array or an object with a "problems" array')
  }
  const seenIds = new Set()
  for (const [index, problem] of problems.entries()) {
    const id = String(problem?.questionId ?? '')
    if (
      !problem ||
      !/^\d+$/.test(id) ||
      typeof problem.title !== 'string' ||
      typeof problem.titleSlug !== 'string' ||
      typeof problem.description !== 'string' ||
      !(
        (Array.isArray(problem.examples) && problem.examples.length > 0) ||
        (typeof problem.exampleTestcases === 'string' && problem.exampleTestcases.trim())
      )
    ) {
      throw new Error(
        `Input problem at index ${index} must include questionId, title, titleSlug, description, and examples or exampleTestcases`,
      )
    }
    if (
      problem.examples !== undefined &&
      (!Array.isArray(problem.examples) ||
        !problem.examples.every((example) => typeof example === 'string'))
    ) {
      throw new Error(`Input problem at index ${index} has invalid examples`)
    }
    if (seenIds.has(id)) throw new Error(`Duplicate questionId ${id} in input`)
    seenIds.add(id)
  }
  const premiumProblems = Array.isArray(parsed) ? [] : (parsed.premiumProblems ?? [])
  if (
    !Array.isArray(premiumProblems) ||
    !premiumProblems.every(
      (problem) =>
        Number.isSafeInteger(problem?.questionId) &&
        problem.questionId > 0 &&
        typeof problem.titleSlug === 'string',
    )
  ) {
    throw new Error('Source "premiumProblems" must contain questionId and titleSlug records')
  }
  return { problems, premiumProblems }
}

const isJsonValue = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue)
  }
  return false
}

const isValueCompatibleWithShape = (shape, value) => {
  if (shape === 'scalar') {
    return value === null || typeof value === 'boolean' || typeof value === 'number'
  }
  if (shape === 'string') return typeof value === 'string'
  if (!Array.isArray(value)) return false
  if (shape === 'array') return value.every((item) => !Array.isArray(item))
  if (shape === 'array_of_strings') return value.every((item) => typeof item === 'string')
  if (shape === 'linked_list') return value.every((item) => !Array.isArray(item))
  if (shape === 'binary_tree') {
    return value.every(
      (item) =>
        item === null ||
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean',
    )
  }
  return value.every(Array.isArray)
}

const validateGeneratedProblem = (problem, generated) => {
  if (!generated || !Array.isArray(generated.testCases) || generated.testCases.length === 0) {
    throw new Error('Model output must include at least one test case')
  }
  for (const [caseIndex, testCase] of generated.testCases.entries()) {
    if (!testCase || !Array.isArray(testCase.inputs) || testCase.inputs.length === 0) {
      throw new Error(`Test case ${caseIndex + 1} must contain a non-empty inputs array`)
    }
    const names = new Set()
    for (const input of testCase.inputs) {
      if (
        !input ||
        typeof input.name !== 'string' ||
        input.name.trim() === '' ||
        names.has(input.name) ||
        !Object.hasOwn(input, 'value') ||
        !isJsonValue(input.value) ||
        !inputShapes.has(input.shape) ||
        !isValueCompatibleWithShape(input.shape, input.value) ||
        (input.nodeStructure !== null &&
          !['linked-list', 'binary-tree', 'graph'].includes(input.nodeStructure))
      ) {
        throw new Error(`Test case ${caseIndex + 1} contains an invalid input`)
      }
      names.add(input.name)
    }
  }

  return {
    questionId: Number(problem.questionId),
    title: problem.title,
    titleSlug: problem.titleSlug,
    testCases: generated.testCases.map(({ inputs }) => ({
      inputs: inputs.map(({ name, value, shape, nodeStructure = null }) => ({
        name,
        value,
        shape,
        nodeStructure,
      })),
    })),
  }
}

const makePrompt = (problem) => {
  const examples = problem.examples ?? (problem.exampleTestcases ? [problem.exampleTestcases] : [])
  return JSON.stringify(
    {
      questionId: problem.questionId,
      title: problem.title,
      titleSlug: problem.titleSlug,
      signature: problem.signature ?? null,
      description: problem.description,
      examples,
    },
    null,
    2,
  )
}

const requestGeneratedProblem = async (
  problem,
  { apiKey, baseUrl, model, promptTemplate, retries },
) => {
  const url = `${baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent`
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: promptTemplate }],
          },
          contents: [{ role: 'user', parts: [{ text: makePrompt(problem) }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      })
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1000)
        const error = new Error(`Gemini request failed (${response.status}): ${detail}`)
        if (attempt >= retries || (response.status !== 429 && response.status < 500)) throw error
      } else {
        const payload = await response.json()
        const parts = payload.candidates?.[0]?.content?.parts
        const content = Array.isArray(parts) ? parts.map((part) => part.text ?? '').join('') : ''
        if (!content) throw new Error('Gemini response did not contain JSON content')
        return validateGeneratedProblem(problem, JSON.parse(content))
      }
    } catch (error) {
      if (attempt >= retries) throw error
      if (
        !(error instanceof TypeError) &&
        !/Gemini request failed \((429|5\d\d)\)/.test(error.message)
      ) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
  }
}

const readExistingOutput = async (outputPath) => {
  try {
    const existing = JSON.parse(await readFile(outputPath, 'utf8'))
    if (
      ![1, 2].includes(existing.schemaVersion) ||
      !existing.problems ||
      typeof existing.problems !== 'object'
    ) {
      throw new Error(`Existing output at ${outputPath} has an unsupported schema`)
    }
    return existing
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

const hasShapeLabels = (problem) =>
  Array.isArray(problem?.testCases) &&
  problem.testCases.length > 0 &&
  problem.testCases.every(
    (testCase) =>
      Array.isArray(testCase.inputs) &&
      testCase.inputs.length > 0 &&
      testCase.inputs.every((input) => inputShapes.has(input.shape)),
  )

const writeJsonAtomically = async (filePath, data) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, filePath)
}

const runPool = async (items, concurrency, work) => {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++]
      await work(item)
    }
  })
  await Promise.all(workers)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.ids && options.limit !== Infinity) {
    throw new Error('Use either --ids or --limit, not both')
  }
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL
  const baseUrl =
    process.env.GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta'
  if (!apiKey) throw new Error('Set GEMINI_API_KEY before running the generator')
  if (!model) throw new Error('Set GEMINI_MODEL to a model available to your account')

  const inputPath = resolveFromRoot(options.input)
  const outputPath = resolveFromRoot(options.output)
  const promptTemplate = await readFile(promptPath, 'utf8')
  if (!promptTemplate.trim()) throw new Error(`Prompt file is empty: ${promptPath}`)
  const sourceData = await readSourceProblems(inputPath)
  const allSourceProblems = sourceData.problems
  let sourceProblems
  if (options.ids) {
    const sourceById = new Map(
      allSourceProblems.map((problem) => [Number(problem.questionId), problem]),
    )
    const premiumIds = new Set(sourceData.premiumProblems.map(({ questionId }) => questionId))
    const selectedPremiumIds = options.ids.filter((id) => premiumIds.has(id))
    if (selectedPremiumIds.length > 0) {
      throw new Error(
        `Problem(s) ${selectedPremiumIds.map((id) => `#${id}`).join(', ')} are marked premium-only and were not fetched. Gemini cannot analyze descriptions that are unavailable to the fetcher.`,
      )
    }
    const missingIds = options.ids.filter((id) => !sourceById.has(id))
    if (missingIds.length > 0) {
      throw new Error(
        `Problem(s) ${missingIds.map((id) => `#${id}`).join(', ')} not found in source data at ${inputPath}`,
      )
    }
    sourceProblems = options.ids.map((id) => sourceById.get(id))
  } else {
    sourceProblems = allSourceProblems.slice(0, options.limit)
  }
  const existing = await readExistingOutput(outputPath)
  const problems = { ...(existing?.problems ?? {}) }
  const pending = sourceProblems.filter(
    (problem) =>
      options.force ||
      !Object.hasOwn(problems, String(problem.questionId)) ||
      !hasShapeLabels(problems[String(problem.questionId)]),
  )
  const failures = []

  console.log(
    `Generating ${pending.length} selected problem(s); ${sourceProblems.length - pending.length} already present with shape labels will be skipped.`,
  )
  await runPool(pending, options.concurrency, async (problem) => {
    const id = String(problem.questionId)
    try {
      problems[id] = await requestGeneratedProblem(problem, {
        apiKey,
        baseUrl,
        model,
        promptTemplate,
        retries: options.retries,
      })
      console.log(`Generated #${id}: ${problem.title}`)
    } catch (error) {
      failures.push({
        questionId: Number(problem.questionId),
        title: problem.title,
        error: error instanceof Error ? error.message : String(error),
      })
      console.error(`Failed #${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    generator: { provider: 'google-gemini', model },
    premiumProblems: [
      ...new Map(
        [...(existing?.premiumProblems ?? []), ...sourceData.premiumProblems].map((problem) => [
          String(problem.questionId),
          problem,
        ]),
      ).values(),
    ].sort((a, b) => a.questionId - b.questionId),
    problems: Object.fromEntries(
      Object.entries(problems).sort(([a], [b]) => Number(a) - Number(b)),
    ),
  }
  await writeJsonAtomically(outputPath, output)

  const errorPath = `${outputPath}.errors.json`
  if (failures.length > 0) {
    await writeJsonAtomically(errorPath, { failedAt: output.generatedAt, failures })
    throw new Error(
      `${failures.length} problem(s) failed. Successful records were saved; rerun to retry failures.`,
    )
  }

  try {
    await unlink(errorPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  console.log(`Saved ${Object.keys(problems).length} total record(s) to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
