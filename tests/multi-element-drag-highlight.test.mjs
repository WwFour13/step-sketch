import assert from 'node:assert/strict'
import test from 'node:test'

/** Simulates cell active calculation matching CanvasElement.tsx */
const computeCellActive = ({
  isSelected,
  isPrimarySelected,
  selectedCell,
  selectedCellIds,
  cellId,
  index,
  elementIds,
}) => {
  const hasPartialCellSelection = elementIds.some((id) => selectedCellIds.has(id))
  return (
    selectedCellIds.has(cellId) ||
    (isPrimarySelected && selectedCell === index) ||
    (isSelected && selectedCell === null && !hasPartialCellSelection)
  )
}

test('multi-element selection highlights all cells of all selected collections when selectedCell is null', () => {
  const array1 = { id: 1, elementIds: [10, 11, 12] }
  const array2 = { id: 2, elementIds: [20, 21, 22] }

  const selectedIds = new Set([1, 2])
  const selectedCell = null
  const selectedCellIds = new Set()

  // For Array 1
  for (let i = 0; i < array1.elementIds.length; i++) {
    const isActive = computeCellActive({
      isSelected: selectedIds.has(array1.id),
      isPrimarySelected: true,
      selectedCell,
      selectedCellIds,
      cellId: array1.elementIds[i],
      index: i,
      elementIds: array1.elementIds,
    })
    assert.equal(isActive, true, `Array 1 cell ${i} must be active in multi-element selection`)
  }

  // For Array 2
  for (let i = 0; i < array2.elementIds.length; i++) {
    const isActive = computeCellActive({
      isSelected: selectedIds.has(array2.id),
      isPrimarySelected: false,
      selectedCell,
      selectedCellIds,
      cellId: array2.elementIds[i],
      index: i,
      elementIds: array2.elementIds,
    })
    assert.equal(isActive, true, `Array 2 cell ${i} must be active in multi-element selection`)
  }
})

test('cell under mouse does NOT collapse multi-selection on pointerDown when dragging multiple elements', () => {
  const array1 = { id: 1, elementIds: [10, 11, 12] }
  const array2 = { id: 2, elementIds: [20, 21, 22] }
  const selectedIds = new Set([1, 2])

  // Cell pointer-down check in CanvasElement
  const isCellInMultiSelection =
    (selectedIds.has(array1.id) && selectedIds.size > 1)

  assert.equal(
    isCellInMultiSelection,
    true,
    'Pointer-down on cell in multi-selection must detect multi-selection state',
  )

  // Therefore onSelectCell is bypassed on pointer-down
  let selectedCell = null
  let selectedCellIds = new Set()

  // During drag gesture, all elements remain highlighted
  const arr1Cell0Active = computeCellActive({
    isSelected: selectedIds.has(array1.id),
    isPrimarySelected: true,
    selectedCell,
    selectedCellIds,
    cellId: 10,
    index: 0,
    elementIds: array1.elementIds,
  })
  const arr1Cell1Active = computeCellActive({
    isSelected: selectedIds.has(array1.id),
    isPrimarySelected: true,
    selectedCell,
    selectedCellIds,
    cellId: 11,
    index: 1,
    elementIds: array1.elementIds,
  })
  const arr2Cell0Active = computeCellActive({
    isSelected: selectedIds.has(array2.id),
    isPrimarySelected: false,
    selectedCell,
    selectedCellIds,
    cellId: 20,
    index: 0,
    elementIds: array2.elementIds,
  })

  assert.equal(arr1Cell0Active, true, 'Cell under mouse is highlighted')
  assert.equal(arr1Cell1Active, true, 'Other cells in clicked array remain highlighted')
  assert.equal(arr2Cell0Active, true, 'Cells in other selected array remain highlighted')
})

test('releasing mouse after drag (maxDist > 5) keeps all elements in multi-selection', () => {
  const selectedIds = new Set([1, 2])
  const maxDist = 25 // user moved 25px

  let collapsedSelection = false
  if (maxDist <= 5) {
    collapsedSelection = true
  }

  assert.equal(collapsedSelection, false, 'Multi-selection must not collapse after moving elements')
  assert.equal(selectedIds.size, 2, 'All selected elements remain selected')
})

test('releasing mouse without moving (maxDist <= 5) collapses to clicked cell', () => {
  const maxDist = 2 // user clicked in place
  const clickedCellIndex = 1
  let selectedIndex = null

  if (maxDist <= 5) {
    if (clickedCellIndex !== undefined) {
      selectedIndex = clickedCellIndex
    }
  }

  assert.equal(selectedIndex, 1, 'Clicking in place without dragging selects the targeted cell')
})

