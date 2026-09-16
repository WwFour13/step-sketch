import { useEffect, useRef, useState } from 'react'
import './App.css'

type Position = { x: number; y: number }
type SketchVariable = {
  id: number
  kind: 'variable'
  label: string
  value: string
  position: Position
}
type SketchArray = {
  id: number
  kind: 'array'
  label: string
  element_ids: number[]
  values: string[]
  position: Position
  layout?: 'horizontal' | 'vertical' | 'map'
}
type SketchNode = Omit<SketchVariable, 'kind'> & {
  kind: 'node'
  pointer_ids: number[]
}
type IteratorColor = 'red' | 'green' | 'blue' | 'yellow'
type SketchIterator = {
  id: number
  kind: 'iterator'
  hostId: number
  color: IteratorColor
}
type SketchElement = SketchVariable | SketchArray | SketchNode | SketchIterator
type LeetCodeQuestion = {
  title: string
  exampleTestcases: string
  codeSnippets: {
    lang: string
    code: string
  }[]
}
type LeetCodeProblemIndex = {
  stat: {
    frontend_question_id: number
    question__title_slug: string
  }
}
const NODE_RADIUS = 27
const iteratorColors: IteratorColor[] = ['red', 'green', 'blue', 'yellow']

const initialElements: SketchElement[] = [
  {
    id: 1,
    kind: 'array',
    label: 'nums',
    element_ids: [2, 3, 4, 5],
    values: ['2', '7', '11', '15'],
    position: { x: 88, y: 150 },
  },
  {
    id: 6,
    kind: 'array',
    label: 'word',
    element_ids: [7, 8, 9, 10, 11, 12, 13, 14],
    values: ['l', 'e', 'e', 't', 'c', 'o', 'd', 'e'],
    position: { x: 388, y: 338 },
  },
]

const leetCodeQuery = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      exampleTestcases
      codeSnippets {
        lang
        code
      }
    }
  }
`
const knownProblemSlugs: Record<string, string> = { '2': 'add-two-numbers' }

const getInputNames = (code: string) => {
  const solutionCode = code.match(/class\s+Solution[\s\S]*/) ? code.match(/class\s+Solution[\s\S]*/)![0] : code
  const signature = solutionCode.match(/(?:def\s+\w+|function\s+\w+|\w+\s*=\s*\([^)]*\))\s*\(([^)]*)\)/)
  if (!signature) return []
  return signature[1].split(',').map((name) => name.trim().replace(/=.*/, '').split(':')[0].trim()).filter((name) => name && name !== 'self')
}

const getFirstTestcase = (exampleTestcases: string, inputCount: number) => exampleTestcases.trim().split('\n').map((line) => line.trim()).filter(Boolean).slice(0, inputCount || 1)

const getPythonSnippet = (codeSnippets: LeetCodeQuestion['codeSnippets']) => codeSnippets.find((snippet) => snippet.lang.toLowerCase() === 'python')?.code ?? codeSnippets[0]?.code ?? ''

const getArrayEditorValue = (array: SketchArray) => {
  if (array.layout === 'map') {
    const pairs: string[] = []
    for (let index = 0; index < array.values.length; index += 2) {
      pairs.push(`${array.values[index] || ''}: ${array.values[index + 1] || ''}`)
    }
    return pairs.join('\n')
  }
  if (array.layout === 'vertical') return array.values.join('\n')
  return array.values.join(', ')
}

const parseArrayEditorValue = (value: string, layout: SketchArray['layout']) => {
  if (layout === 'map') {
    return value.split('\n').flatMap((line) => {
      const separator = line.indexOf(':')
      return separator < 0
        ? [line.trim(), '']
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    })
  }
  if (layout === 'vertical') return value.split('\n').map((line) => line.trim())
  return value.split(',').map((item) => item.trim())
}


function App() {
  const [elements, setElements] = useState<SketchElement[]>(initialElements)
  const [selectedId, setSelectedId] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([1]))
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [nextId, setNextId] = useState(15)
  const [problemNumber, setProblemNumber] = useState('2')
  const [isLoadingProblem, setIsLoadingProblem] = useState(false)
  const [problemStatus, setProblemStatus] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number; draggedIds: Set<number>; initialPositions: Map<number, Position> } | null>(null)
  const pointerRef = useRef<{ sourceId: number; x: number; y: number } | null>(null)
  const relationshipRef = useRef<{ sourceId: number; targetId: number; startX: number; startY: number } | null>(null)
  const iteratorDragRef = useRef<{ id: number; startX: number; startY: number } | null>(null)
  const iteratorClickRef = useRef<{ id: number; time: number } | null>(null)
  const cellEditRef = useRef<{ arrayId: number; index: number; hasTyped: boolean } | null>(null)
  const marqueeRef = useRef<{ startX: number; startY: number; additive: boolean } | null>(null)
  const [pointerDraft, setPointerDraft] = useState<{ sourceId: number; x: number; y: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [iteratorDrag, setIteratorDrag] = useState<{ id: number; x: number; y: number } | null>(null)
  const selected = elements.find((element) => element.id === selectedId)

  const selectCell = (arrayId: number, index: number) => {
    cellEditRef.current = { arrayId, index, hasTyped: false }
    setSelectedCell(index)
  }

  const resetCellTyping = () => {
    if (cellEditRef.current) cellEditRef.current.hasTyped = false
  }

  const selectOne = (id: number, additive = false) => {
    setSelectedIds((current) => {
      const next = additive ? new Set(current) : new Set<number>()
      next.add(id)
      return next
    })
    setSelectedId(id)
  }

  const deleteElement = (id: number) => {
    const idsToDelete = new Set(selectedIds.has(id) ? selectedIds : [id])
    setElements((current) => {
      const deletedIds = new Set<number>()
      current.forEach((element) => {
        if (idsToDelete.has(element.id)) {
          deletedIds.add(element.id)
          if (element.kind === 'array') element.element_ids.forEach((elementId) => deletedIds.add(elementId))
        }
      })
      return current
        .filter((item) => !deletedIds.has(item.id) && !(item.kind === 'iterator' && deletedIds.has(item.hostId)))
        .map((item) => item.kind === 'node'
          ? { ...item, pointer_ids: item.pointer_ids.filter((pointerId) => !deletedIds.has(pointerId)) }
          : item)
    })
    setSelectedId(0)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
      const isEditing = activeElement?.id === 'label' || activeElement?.id === 'value' || activeElement?.id === 'problem-number'
      const cellEdit = cellEditRef.current
      if (cellEdit && !isEditing && (event.key.length === 1 || event.key === 'Backspace')) {
        event.preventDefault()
        setElements((current) => current.map((element) => {
          if (element.kind !== 'array' || element.id !== cellEdit.arrayId || cellEdit.index >= element.values.length) return element
          const values = [...element.values]
          values[cellEdit.index] = event.key === 'Backspace'
            ? (cellEdit.hasTyped ? values[cellEdit.index].slice(0, -1) : '')
            : (cellEdit.hasTyped ? values[cellEdit.index] + event.key : event.key)
          cellEdit.hasTyped = true
          return { ...element, values }
        }))
        return
      }
      if (event.key === 'Delete' && selectedId && !isEditing) {
        deleteElement(selectedId)
      }
    }
    const handleMouseDown = () => {
      resetCellTyping()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [selectedId, selectedIds])

  const updateSelected = (patch: Partial<SketchElement>) => {
    if (selected?.kind === 'array' && 'values' in patch && Array.isArray(patch.values)) {
      const values = patch.values as string[]
      const addedCellCount = Math.max(0, values.length - selected.element_ids.length)
      const removedCellIds = new Set(selected.element_ids.slice(values.length))
      setElements((current) => current
        .filter((element) => !(element.kind === 'iterator' && removedCellIds.has(element.hostId)))
        .map((element) => {
          if (element.id !== selectedId || element.kind !== 'array') return element
          const elementIds = values.map((_, index) => element.element_ids[index] ?? nextId + index)
          return { ...element, ...patch, values, element_ids: elementIds }
        }) as SketchElement[])
      if (addedCellCount > 0) setNextId((current) => current + addedCellCount)
      return
    }
    setElements((current) => current.map((element) => (
      element.id === selectedId ? { ...element, ...patch } : element
    )) as SketchElement[])
  }

  const elementBounds = (element: SketchElement) => ({
    x: element.kind === 'iterator' ? 0 : element.position.x,
    y: element.kind === 'iterator' ? 0 : element.position.y,
    width: element.kind === 'iterator' || element.kind === 'node' || element.kind === 'variable' || element.layout === 'vertical' ? 54 : element.layout === 'map' ? 84 : element.values.length * 42,
    height: element.kind === 'iterator' || element.kind === 'node' || element.kind === 'variable' || element.layout === 'horizontal' || !element.layout ? 54 : element.layout === 'map' ? Math.ceil(element.values.length / 2) * 42 : element.values.length * 42,
  })

  const hostBounds = (hostId: number) => {
    const host = elements.find((element) => element.id === hostId)
    if (host?.kind === 'node') return { x: host.position.x, y: host.position.y, width: 54, height: 54 }
    const array = elements.find((element): element is SketchArray => element.kind === 'array' && (!element.layout || element.layout === 'horizontal') && element.element_ids.includes(hostId))
    if (!array) return null
    const index = array.element_ids.indexOf(hostId)
    const column = array.layout === 'map' ? index % 2 : array.layout === 'vertical' ? 0 : index
    const row = array.layout === 'map' ? Math.floor(index / 2) : array.layout === 'vertical' ? index : 0
    return { x: array.position.x + column * 42, y: array.position.y + row * 42, width: 42, height: 42 }
  }

  const iteratorPosition = (iterator: SketchIterator) => {
    const bounds = hostBounds(iterator.hostId)
    if (!bounds) return { x: 0, y: 0 }
    const siblings = elements.filter((element): element is SketchIterator => element.kind === 'iterator' && element.hostId === iterator.hostId)
    const siblingIndex = siblings.findIndex((item) => item.id === iterator.id)
    const horizontalOffset = (siblingIndex - (siblings.length - 1) / 2) * 14
    return { x: bounds.x + bounds.width / 2 - 6 + horizontalOffset, y: bounds.y + bounds.height + 5 }
  }

  const hostIdFromPoint = (clientX: number, clientY: number) => {
    for (const offset of [0, 8, 16, 24, 32]) {
      const target = document.elementFromPoint(clientX, clientY - offset)?.closest<HTMLElement>('[data-host-id], [data-host-cell-id]')
      if (!target) continue
      const cellId = target.dataset.hostCellId
      if (cellId && hostBounds(Number(cellId))) return Number(cellId)
      const nodeId = target.dataset.hostId
      if (nodeId && hostBounds(Number(nodeId))) return Number(nodeId)
    }
    return null
  }

  const addIterator = (hostId: number) => {
    if (!hostBounds(hostId)) return
    const id = nextId
    const count = elements.filter((element) => element.kind === 'iterator').length
    const iterator: SketchIterator = { id, kind: 'iterator', hostId, color: iteratorColors[count % iteratorColors.length] }
    setElements((current) => [...current, iterator])
    setNextId((current) => current + 1)
    selectOne(id)
  }

  const handleHostDoubleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const hostId = target.dataset.hostCellId || target.closest<HTMLElement>('[data-host-cell-id]')?.dataset.hostCellId || target.dataset.hostId
    if (!hostId) return
    event.stopPropagation()
    addIterator(Number(hostId))
  }

  const startIteratorDrag = (event: React.PointerEvent, iterator: SketchIterator) => {
    if (event.button === 2) {
      event.preventDefault()
      event.stopPropagation()
      advanceIterator(iterator)
      return
    }
    if (event.button !== 0) return
    const now = Date.now()
    const previousClick = iteratorClickRef.current
    if (previousClick?.id === iterator.id && now - previousClick.time < 500) {
      iteratorClickRef.current = null
      deleteElement(iterator.id)
    } else {
      iteratorClickRef.current = { id: iterator.id, time: now }
    }
    iteratorDragRef.current = { id: iterator.id, startX: event.clientX, startY: event.clientY }
    setIteratorDrag({ id: iterator.id, x: event.clientX, y: event.clientY })
    selectOne(iterator.id)
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const updateMarquee = (event: React.PointerEvent) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const marquee = marqueeRef.current
    if (!bounds || !marquee) return
    const currentX = event.clientX - bounds.left
    const currentY = event.clientY - bounds.top
    const x = Math.min(marquee.startX, currentX)
    const y = Math.min(marquee.startY, currentY)
    const width = Math.abs(currentX - marquee.startX)
    const height = Math.abs(currentY - marquee.startY)
    setSelectionBox({ x, y, width, height })
    const selectedInBox = elements.filter((element) => element.kind !== 'iterator').filter((element) => {
      const item = elementBounds(element)
      return item.x < x + width && item.x + item.width > x && item.y < y + height && item.y + item.height > y
    }).map((element) => element.id)
    setSelectedIds((currentSelection) => {
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      selectedInBox.forEach((id) => next.add(id))
      return next
    })
    if (selectedInBox.length > 0) setSelectedId(selectedInBox[0])
    setSelectedCell(null)
  }

  const addVariable = (kind: 'variable' | 'node') => {
    const id = nextId
    const value = String(Math.floor(Math.random() * 10))
    const position = { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 }
    const element: SketchElement = kind === 'node'
      ? { id, kind, label: '', value, pointer_ids: [], position }
      : { id, kind, label: 'variable', value, position }
    setElements((current) => [...current, element])
    setNextId((current) => current + 1)
    selectOne(id)
  }

  const addArray = (values: string[], label: string) => {
    const id = nextId
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [...current, { id, kind: 'array', label, element_ids: elementIds, values, position: { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 }, layout: 'horizontal' }])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addSet = () => {
    const id = nextId
    const values = ['2', '7', '11', '15']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [...current, { id, kind: 'array', label: 'set', element_ids: elementIds, values, position: { x: 180, y: 120 }, layout: 'vertical' }])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addMap = () => {
    const id = nextId
    const values = ['name', 'Ada', 'role', 'coder', 'level', '42']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [...current, { id, kind: 'array', label: 'map', element_ids: elementIds, values, position: { x: 180, y: 120 }, layout: 'map' }])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addLinkedList = () => {
    const firstId = nextId
    const nodes: SketchNode[] = [0, 1, 2].map((index) => ({
      id: firstId + index,
      kind: 'node',
      label: '',
      value: String(index + 1),
      pointer_ids: index < 2 ? [firstId + index + 1] : [],
      position: { x: 140 + index * 120, y: 170 },
    }))
    setElements((current) => [...current, ...nodes])
    setNextId((current) => current + nodes.length)
    selectOne(firstId)
  }

  const addBinaryTree = () => {
    const firstId = nextId
    const positions = [
      { x: 330, y: 110 },
      { x: 200, y: 240 },
      { x: 460, y: 240 },
      { x: 135, y: 370 },
      { x: 265, y: 370 },
      { x: 395, y: 370 },
      { x: 525, y: 370 },
    ]
    const nodes: SketchNode[] = [0, 1, 2, 3, 4, 5, 6].map((index) => {
      const leftId = firstId + index * 2 + 1
      const rightId = firstId + index * 2 + 2
      const pointerIds = [leftId, rightId].filter((pointerId) => pointerId < firstId + 7)
      return {
        id: firstId + index,
        kind: 'node' as const,
        label: '',
        value: String(index + 1),
        pointer_ids: pointerIds,
        position: positions[index],
      }
    })
    setElements((current) => [...current, ...nodes])
    setNextId((current) => current + nodes.length)
    selectOne(firstId)
  }

  const addLeetCodeTestCase = async () => {
    const number = problemNumber.trim()
    if (!/^\d+$/.test(number)) {
      setProblemStatus('Enter a problem number')
      return
    }
    setIsLoadingProblem(true)
    setProblemStatus('')
    try {
      let titleSlug = knownProblemSlugs[number]
      if (!titleSlug) {
        const indexResponse = await fetch('/leetcode-api/api/problems/all/')
        if (!indexResponse.ok) throw new Error('unable to load problem index')
        const indexPayload = await indexResponse.json() as { stat_status_pairs: LeetCodeProblemIndex[] }
        const problem = indexPayload.stat_status_pairs.find((item) => String(item.stat.frontend_question_id) === number)
        if (!problem) throw new Error('problem number not found')
        titleSlug = problem.stat.question__title_slug
      }

      const response = await fetch('/leetcode-api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: leetCodeQuery, variables: { titleSlug } }),
      })
      if (!response.ok) throw new Error('LeetCode request failed')
      const payload = await response.json() as { data?: { question?: LeetCodeQuestion | null } }
      const question = payload.data?.question
      if (!question) throw new Error('Problem not found')

      const snippet = getPythonSnippet(question.codeSnippets)
      const inputNames = getInputNames(snippet)
      const lines = getFirstTestcase(question.exampleTestcases, inputNames.length)
      const parsedValues = lines.map((line) => {
        try {
          return JSON.parse(line) as unknown
        } catch {
          return line
        }
      })
      const hasLinkedListInput = /\b(ListNode|LinkedList)\b/.test(snippet)
      const hasGraphNodeInput = /\b(GraphNode|Node)\b/.test(snippet) && !hasLinkedListInput
      const hasUnsupportedValue = parsedValues.some((value) => (
        typeof value === 'object' && value !== null && (!Array.isArray(value) || value.some((item) => Array.isArray(item) || (typeof item === 'object' && item !== null)))
      ))
      const firstId = nextId
      if (hasUnsupportedValue || hasGraphNodeInput || parsedValues.length === 0) {
        const reason = hasGraphNodeInput ? 'graph node' : parsedValues.some((value) => Array.isArray(value) && value.some(Array.isArray)) ? '2d array' : 'unsupported input structure'
        const fallback: SketchArray = {
          id: firstId,
          kind: 'array',
          label: `LeetCode ${number} testcase`,
          element_ids: [firstId + 1],
          values: [`Missing representation: ${reason}`],
          position: { x: 130, y: 100 },
        }
        setElements((current) => [...current, fallback])
        setNextId((current) => current + 2)
        selectOne(firstId)
      } else {
        let nextImportedId = firstId
        const imported: (SketchElement | SketchNode[] | SketchArray[])[] = parsedValues.map((value, index) => {
          if (typeof value === 'string') {
            const id = nextImportedId
            const characters = Array.from(value)
            nextImportedId += characters.length + 1
            return {
              id,
              kind: 'array' as const,
              label: inputNames[index] || `arg${index + 1}`,
              element_ids: characters.map((_, characterIndex) => id + characterIndex + 1),
              values: characters,
              position: { x: 130, y: 100 + index * 90 },
            }
          }
          if (Array.isArray(value)) {
            const id = nextImportedId
            if (value.length > 0 && value.every((item) => typeof item === 'string')) {
              const label = inputNames[index] || `arg${index + 1}`
              const stringArrays: SketchArray[] = value.map((item, stringIndex) => {
                const stringId = nextImportedId
                const characters = Array.from(item as string)
                nextImportedId += characters.length + 1
                return {
                  id: stringId,
                  kind: 'array',
                  label: `${label}[${stringIndex}]`,
                  element_ids: characters.map((_, characterIndex) => stringId + characterIndex + 1),
                  values: characters,
                  position: { x: 130, y: 100 + (index + stringIndex) * 90 },
                }
              })
              return stringArrays
            }
            const label = inputNames[index] || `arg${index + 1}`
            if (hasLinkedListInput) {
              const nodes: SketchNode[] = value.map((item, nodeIndex) => ({
                id: id + nodeIndex,
                kind: 'node' as const,
                label,
                value: String(item),
                pointer_ids: nodeIndex < value.length - 1 ? [id + nodeIndex + 1] : [],
                position: { x: 130 + nodeIndex * 90, y: 100 + index * 110 },
              }))
              nextImportedId += nodes.length
              return nodes
            }
            nextImportedId += value.length + 1
            return {
              id,
              kind: 'array' as const,
              label,
              element_ids: value.map((_, valueIndex) => id + valueIndex + 1),
              values: value.map(String),
              position: { x: 130, y: 100 + index * 90 },
            }
          }
          const id = nextImportedId
          nextImportedId += 1
          return {
            id,
            kind: 'variable' as const,
            label: inputNames[index] || `arg${index + 1}`,
            value: String(value),
            position: { x: 130, y: 100 + index * 90 },
          }
        })
        const flatImported: SketchElement[] = imported.flat()
        setElements((current) => [...current, ...flatImported])
        setNextId(nextImportedId)
        selectOne(firstId)
      }
      setProblemStatus(question.title)
    } catch (error) {
      const fallback: SketchArray = {
        id: nextId,
        kind: 'array',
        label: `LeetCode ${number} testcase`,
        element_ids: [nextId + 1],
        values: [`Missing representation: ${error instanceof Error ? error.message : 'unable to load problem'}`],
        position: { x: 130, y: 100 },
      }
      setElements((current) => [...current, fallback])
      setNextId((current) => current + 2)
      selectOne(nextId)
      setProblemStatus('Loaded fallback')
    } finally {
      setIsLoadingProblem(false)
    }
  }

  const advanceIterator = (iterator: SketchIterator) => {
    const host = elements.find((element) => element.id === iterator.hostId && element.kind === 'node')
      || elements.find((element) => element.kind === 'array' && (!element.layout || element.layout === 'horizontal') && element.element_ids.includes(iterator.hostId))
    let nextHostId: number | null = null
    if (host?.kind === 'node' && host.pointer_ids.length === 1) nextHostId = host.pointer_ids[0]
    if (host?.kind === 'array') {
      const index = host.element_ids.indexOf(iterator.hostId)
      if (index >= 0 && index < host.element_ids.length - 1) nextHostId = host.element_ids[index + 1]
    }
    if (nextHostId === null) return
    setElements((current) => current.map((element) => element.kind === 'iterator' && element.id === iterator.id ? { ...element, hostId: nextHostId! } : element))
  }

  const startDrag = (event: React.PointerEvent, id: number) => {
    const element = elements.find((item) => item.id === id)
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!element || !bounds) return
    let activeSelection = selectedIds.has(id) ? new Set(selectedIds) : new Set([id])
    if (event.shiftKey && element.kind === 'node') {
      const visited = new Set<number>(activeSelection)
      const pendingIds = [id]
      while (pendingIds.length > 0) {
        const currentId = pendingIds.shift()!
        const currentElement = elements.find((item) => item.id === currentId)
        if (currentElement?.kind !== 'node') continue
        currentElement.pointer_ids.forEach((pointerId) => {
          if (visited.has(pointerId)) return
          visited.add(pointerId)
          pendingIds.push(pointerId)
        })
      }
      activeSelection = visited
      setSelectedIds(visited)
    } else if (!selectedIds.has(id)) {
      selectOne(id)
      activeSelection = new Set([id])
    }
    if (element.kind === 'array' && (selectedIds.size > 1 || !(event.target instanceof HTMLInputElement))) setSelectedCell(null)
    if (event.button === 2 && element.kind === 'node') {
      pointerRef.current = { sourceId: id, x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      setPointerDraft(pointerRef.current)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    const draggedIds = new Set<number>()
    activeSelection.forEach((selectedElementId) => {
      const selectedElement = elements.find((item) => item.id === selectedElementId)
      if (!selectedElement) return
      draggedIds.add(selectedElement.id)
      if (selectedElement.kind === 'array') selectedElement.element_ids.forEach((elementId) => draggedIds.add(elementId))
    })
    const primaryElement = elements.find((item): item is Exclude<SketchElement, SketchIterator> => item.id === id && item.kind !== 'iterator') ?? (element.kind === 'iterator' ? null : element)
    if (!primaryElement) return
    dragRef.current = {
      id,
      offsetX: event.clientX - bounds.left - primaryElement.position.x,
      offsetY: event.clientY - bounds.top - primaryElement.position.y,
      draggedIds,
      initialPositions: new Map(elements.filter((item): item is Exclude<SketchElement, SketchIterator> => item.kind !== 'iterator' && draggedIds.has(item.id)).map((item) => [item.id, item.position])),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveElement = (event: React.PointerEvent) => {
    if (iteratorDragRef.current) {
      setIteratorDrag({ id: iteratorDragRef.current.id, x: event.clientX, y: event.clientY })
      return
    }
    if (pointerRef.current) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (!bounds) return
      const draft = { ...pointerRef.current, x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      pointerRef.current = draft
      setPointerDraft(draft)
      return
    }
    if (!dragRef.current) return
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return
    const { id, offsetX, offsetY, draggedIds, initialPositions } = dragRef.current
    const primaryPosition = initialPositions.get(id)
    if (!primaryPosition) return
    const x = Math.max(12, event.clientX - bounds.left - offsetX)
    const y = Math.max(24, event.clientY - bounds.top - offsetY)
    const deltaX = x - primaryPosition.x
    const deltaY = y - primaryPosition.y
    setElements((current) => current.map((element) => {
      const initialPosition = initialPositions.get(element.id)
      if (!draggedIds.has(element.id) || !initialPosition || element.kind === 'iterator') return element
      return {
        ...element,
        position: {
          x: Math.max(12, initialPosition.x + deltaX),
          y: Math.max(24, initialPosition.y + deltaY),
        },
      }
    }))
  }

  const finishPointer = (event: React.PointerEvent) => {
    if (iteratorDragRef.current) {
      const draggedIterator = iteratorDragRef.current
      const moved = Math.hypot(event.clientX - draggedIterator.startX, event.clientY - draggedIterator.startY) > 4
      if (moved) {
        const hostId = hostIdFromPoint(event.clientX, event.clientY)
        if (hostId !== null) {
          setElements((current) => current.map((element) => element.kind === 'iterator' && element.id === draggedIterator.id ? { ...element, hostId } : element))
        }
      }
      iteratorDragRef.current = null
      setIteratorDrag(null)
      return
    }
    // If an existing arrow was dragged, update or remove only that one arrow.
    if (relationshipRef.current) {
      const relationship = relationshipRef.current
      // Ignore tiny pointer movements so a normal click does not redraw an arrow.
      const moved = Math.hypot(event.clientX - relationship.startX, event.clientY - relationship.startY) > 4
      if (moved) {
        
        // React state updates receive the previous array and return the next array.
        setElements((current) => current.map((element) => {
          // Leave every other element unchanged.
          if (element.kind !== 'node' || element.id !== relationship.sourceId) return element
          // Removing the stored target deletes only this one relationship.
          const remainingPointers = element.pointer_ids.filter((pointerId) => pointerId !== relationship.targetId)
          return { ...element, pointer_ids: remainingPointers }
        }))
      }
      // Clear the temporary drag information when the pointer is released.
      relationshipRef.current = null
      return
    }
    // A marquee selection ends when the pointer is released.
    if (marqueeRef.current) {
      marqueeRef.current = null
      setSelectionBox(null)
      return
    }
    // If this was not a relationship or marquee drag, stop here unless it was a new pointer.
    if (!pointerRef.current) {
      dragRef.current = null
      return
    }
    // A new pointer uses the node under the release point as its target.
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-node-id]')
    const targetId = target ? Number(target.dataset.nodeId) : null
    const sourceId = pointerRef.current.sourceId
    // Add the new target, or clear all targets when released on empty space.
    setElements((current) => current.map((element) => {
      // Only the node where the right-drag started is changed.
      if (element.id !== sourceId || element.kind !== 'node') return element
      
      if (!targetId || targetId === sourceId) {
        return { ...element, pointer_ids: [] }
      } 

      return element.pointer_ids.includes(targetId)
        ? { ...element, pointer_ids: element.pointer_ids.filter((pointerId) => pointerId !== targetId) }
        : { ...element, pointer_ids: [...element.pointer_ids, targetId] }
    }))
    // Clear the temporary pointer preview after release.
    pointerRef.current = null
    setPointerDraft(null)
  }

  const nodePosition = (id: number) => elements.find((element): element is SketchNode => element.kind === 'node' && element.id === id)?.position

  const pointerEndpoints = (source: Position, target: Position) => {
    const sourceCenter = { x: source.x + NODE_RADIUS, y: source.y + NODE_RADIUS }
    const targetCenter = { x: target.x + NODE_RADIUS, y: target.y + NODE_RADIUS }
    const dx = targetCenter.x - sourceCenter.x
    const dy = targetCenter.y - sourceCenter.y
    const distance = Math.hypot(dx, dy) || 1
    return {
      x1: sourceCenter.x + (dx / distance) * NODE_RADIUS,
      y1: sourceCenter.y + (dy / distance) * NODE_RADIUS,
      x2: targetCenter.x - (dx / distance) * NODE_RADIUS,
      y2: targetCenter.y - (dy / distance) * NODE_RADIUS,
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">~</span>
        <span>sketch<span className="brand-accent">/</span>code</span>
      </div>
      <div className="breadcrumb">
        <span>Untitled board</span>
        <span className="dot">•</span>
        <span>Saved just now</span>
      </div>
      <div className="top-actions">
        <button className="icon-button" aria-label="Undo">↶</button>
        <button className="icon-button" aria-label="Redo">↷</button>
        <span className="divider" />
        <button className="share-button">Share <span>↗</span></button>
        <button className="avatar">JD</button>
      </div>
    </header>
    <div className="workspace">
      <aside className="sidebar">

        <div className="tool-section">
        
          <div className="section-label">ADD TO CANVAS</div>
          <div className="template-list">
            <button className="template-button" title="single square" onClick={() => addVariable('variable')}><span className="template-icon">□</span><span className="template-copy"><strong>Variable</strong></span></button>
            <button className="template-button" title="[ 1, 4, 9, 16 ]" onClick={() => addArray(['1', '4', '9', '16'], 'array')}><span className="template-icon">[]</span><span className="template-copy"><strong>Array</strong></span></button>
            <button className="template-button" title="1 → 2 → 3" onClick={addLinkedList}><span className="template-icon">→→</span><span className="template-copy"><strong>Linked list</strong></span></button>
            <button className="template-button" title="vertical unique values" onClick={addSet}><span className="template-icon">∪</span><span className="template-copy"><strong>Set</strong></span></button>
            <button className="template-button" title="pointer target" onClick={() => addVariable('node')}><span className="template-icon">→</span><span className="template-copy"><strong>Node</strong></span></button>
            <button className="template-button" title='"algo" as cells' onClick={() => addArray(['a', 'l', 'g', 'o'], 'text')}><span className="template-icon">Aa</span><span className="template-copy"><strong>String</strong></span></button>
            <button className="template-button" title="7 connected nodes" onClick={addBinaryTree}><span className="template-icon">⋔</span><span className="template-copy"><strong>Binary tree</strong></span></button>
            <button className="template-button" title="key / value pairs" onClick={addMap}><span className="template-icon">↔</span><span className="template-copy"><strong>Map</strong></span></button>
            <div className="template-button leetcode-import">
              <span className="template-icon">#</span>
              <strong className="leetcode-label">LeetCode</strong>
              <input id="problem-number" type="number" min="1" value={problemNumber} onChange={(event) => setProblemNumber(event.target.value)} aria-label="LeetCode problem number" />
              <button type="button" onClick={addLeetCodeTestCase} disabled={isLoadingProblem}>{isLoadingProblem ? '...' : 'Load'}</button>
            </div>
          </div>
          {problemStatus && <div className="problem-status">{problemStatus}</div>}
        </div>
        {selected ? (
          <div className="inspector">
            <div className="section-label">SELECTED ELEMENT</div>
            {selected.kind !== 'node' && selected.kind !== 'iterator' && <div className="field-row">
              <label htmlFor="label">Label</label>
              <input id="label" value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} />
            </div>}
            {selected.kind !== 'iterator' && <div className="field-row">
              <label htmlFor="value">Value</label>
              <textarea
                id="value"
                value={selected.kind === 'array' ? getArrayEditorValue(selected) : selected.value}
                onChange={(event) => selected.kind === 'array'
                  ? updateSelected({ values: parseArrayEditorValue(event.target.value, selected.layout) })
                  : updateSelected({ value: event.target.value })}
              />
            </div>
            }
            {selected.kind === 'array' && <p className="field-help">{selected.layout === 'map' ? 'One key: value pair per line' : selected.layout === 'vertical' ? 'One value per line' : 'Separate values with commas'}</p>}
            {selected.kind === 'iterator' && <div className="field-row iterator-color-field">
              <label>Iterator color</label>
              <div className="iterator-color-options" role="radiogroup" aria-label="Iterator color">
                {iteratorColors.map((color) => <label key={color} className="iterator-color-option" title={color}>
                  <input type="radio" name="iterator-color" value={color} checked={selected.color === color} onChange={() => updateSelected({ color })} />
                  <span className={`color-radio color-${color}`} />
                </label>)}
              </div>
            </div>}
            <button
              className="delete-button"
              onClick={() => deleteElement(selected.id)}
            >
              Delete element <span>⌫</span>
            </button>
          </div>
        ) : <div className="empty-inspector">Select an element to edit it</div>}
        <div className="sidebar-footer">
          <button className="help-button">? <span>Shortcuts</span><kbd>⌘ /</kbd></button>
          <span className="version">v1.0</span>
        </div>
      </aside>
      <section className="canvas-area">
        
        <div ref={canvasRef} className="canvas" onPointerMove={(event) => {
          if (marqueeRef.current) updateMarquee(event)
          else moveElement(event)
        }} onPointerUp={finishPointer} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => {
          resetCellTyping()
          if (event.target === event.currentTarget && event.button === 0) {
            const bounds = canvasRef.current?.getBoundingClientRect()
            if (!bounds) return
            marqueeRef.current = { startX: event.clientX - bounds.left, startY: event.clientY - bounds.top, additive: event.shiftKey }
            if (!event.shiftKey) {
              setSelectedIds(new Set())
              setSelectedId(0)
            }
            setSelectedCell(null)
            event.currentTarget.setPointerCapture(event.pointerId)
          }
        }}>
          <svg className="pointer-layer" aria-hidden="true">
            <defs>
              <marker id="pointer-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            {elements.filter((element): element is SketchNode => element.kind === 'node').flatMap((node) => node.pointer_ids.map((pointerId) => {
              const target = nodePosition(pointerId)
              if (!target) return null
              const endpoints = pointerEndpoints(node.position, target)
              return <line key={`${node.id}-${pointerId}`} className="pointer-relationship" {...endpoints} markerEnd="url(#pointer-arrow)" onPointerDown={(event) => {
                if (event.button !== 0) return
                relationshipRef.current = { sourceId: node.id, targetId: pointerId, startX: event.clientX, startY: event.clientY }
                event.stopPropagation()
                event.currentTarget.setPointerCapture(event.pointerId)
              }} onPointerUp={(event) => {
                finishPointer(event)
                event.stopPropagation()
              }} onLostPointerCapture={finishPointer} />
            }))}
            {pointerDraft && nodePosition(pointerDraft.sourceId) && <line className="pointer-draft" {...pointerEndpoints(nodePosition(pointerDraft.sourceId)!, { x: pointerDraft.x - NODE_RADIUS, y: pointerDraft.y - NODE_RADIUS })} />}
          </svg>
          {elements.filter((element) => element.kind !== 'iterator').map((element) => (
            <div
              key={element.id}
              data-node-id={element.kind === 'node' ? element.id : undefined}
              data-host-id={element.kind === 'node' ? element.id : undefined}
              className={`canvas-element ${selectedIds.has(element.id) ? 'selected' : ''} kind-${element.kind}`}
              style={{ left: element.position.x, top: element.position.y }}
              onPointerDown={(event) => startDrag(event, element.id)}
              onDoubleClick={handleHostDoubleClick}
            >
              {element.kind === 'array' ? <><div className="element-label">{element.label}</div><div className={`array-cells layout-${element.layout || 'horizontal'}`}>{element.values.map((value, index) => <input key={element.element_ids[index]} data-host-cell-id={!element.layout || element.layout === 'horizontal' ? element.element_ids[index] : undefined} value={value} readOnly className={`array-cell-input ${selectedIds.has(element.id) && (selectedCell === null || selectedCell === index) ? 'cell-active' : ''}`} onPointerDown={() => { resetCellTyping(); selectCell(element.id, index) }} onMouseDown={(event) => { resetCellTyping(); if ((!element.layout || element.layout === 'horizontal') && event.detail === 2) { event.stopPropagation(); addIterator(element.element_ids[index]) } event.preventDefault() }} onSelect={(event) => event.currentTarget.setSelectionRange(0, 0)} />)}</div></> : <><>{element.label && <div className="element-label">{element.label}</div>}</><div className="variable-square"><span className="variable-value">{element.value}</span></div></>}
            </div>
          ))}
          {elements.filter((element): element is SketchIterator => element.kind === 'iterator').map((iterator) => {
            const position = iteratorDrag?.id === iterator.id && canvasRef.current
              ? { x: iteratorDrag.x - canvasRef.current.getBoundingClientRect().left - 6, y: iteratorDrag.y - canvasRef.current.getBoundingClientRect().top - 4 }
              : iteratorPosition(iterator)
            return <div
              key={iterator.id}
              className={`iterator-triangle color-${iterator.color} ${selectedIds.has(iterator.id) ? 'selected' : ''}`}
              style={{ left: position.x, top: position.y, pointerEvents: iteratorDrag?.id === iterator.id ? 'none' : 'auto' }}
              title={`Iterator on ${iterator.hostId}`}
              onPointerDown={(event) => startIteratorDrag(event, iterator)}
            />
          })}
          {selectionBox && <div className="selection-box" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
          <div className="canvas-hint">
            <span>+</span>
            <span>Drag elements to arrange your explanation</span>
          </div>
        </div>
        <footer className="canvas-footer">
          <span><kbd>⌘</kbd> <kbd>Enter</kbd> to present</span>
          <span><kbd>Delete</kbd> to remove selection</span>
          <span className="footer-right">Canvas 1200 x 760</span>
        </footer>
      </section>
    </div>
  </main>
}

export default App
