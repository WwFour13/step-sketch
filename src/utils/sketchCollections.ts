import type {
  SketchArray,
  SketchCollection,
  SketchElement,
  SketchMap,
  SketchMatrix,
  SketchSet,
  SketchArrayInputType,
} from '../types/sketch'

export const isSketchCollection = (element: SketchElement): element is SketchCollection =>
  element.kind === 'array' ||
  element.kind === 'set' ||
  element.kind === 'map' ||
  element.kind === 'matrix'

export const getCollectionLayout = (collection: SketchCollection) => {
  switch (collection.kind) {
    case 'set':
      return 'vertical'
    case 'map':
      return 'map'
    case 'matrix':
      return 'matrix'
    case 'array':
      return 'horizontal'
  }
}

export const getCollectionValues = (collection: SketchCollection): string[] =>
  collection.kind === 'matrix' ? collection.values.flat() : [...collection.values]

export const getCollectionElementIds = (collection: SketchCollection): number[] =>
  collection.kind === 'matrix' ? collection.element_ids.flat() : [...collection.element_ids]

export const getCollectionColumns = (collection: SketchMatrix): number =>
  Math.max(1, collection.columns)

export const withCollectionCells = (
  collection: SketchCollection,
  values: string[],
  elementIds: number[],
): SketchCollection => {
  if (collection.kind !== 'matrix') {
    return { ...collection, values, element_ids: elementIds }
  }

  const columns = getCollectionColumns(collection)
  const valuesByRow: string[][] = []
  const idsByRow: number[][] = []
  for (let index = 0; index < values.length; index += columns) {
    valuesByRow.push(values.slice(index, index + columns))
    idsByRow.push(elementIds.slice(index, index + columns))
  }
  return {
    ...collection,
    values: valuesByRow,
    element_ids: idsByRow,
  }
}

export const createSketchArray = (
  kind: SketchArray['kind'] | SketchSet['kind'] | SketchMap['kind'] | SketchMatrix['kind'],
  id: number,
  label: string,
  values: string[],
  elementIds: number[],
  position: SketchCollection['position'],
  columns?: number,
  inputType?: SketchArrayInputType,
): SketchCollection => {
  if (kind === 'matrix') {
    const matrixColumns = Math.max(1, columns ?? 1)
    const matrixValues: string[][] = []
    const matrixIds: number[][] = []
    for (let index = 0; index < values.length; index += matrixColumns) {
      matrixValues.push(values.slice(index, index + matrixColumns))
      matrixIds.push(elementIds.slice(index, index + matrixColumns))
    }
    return {
      id,
      kind,
      label,
      values: matrixValues,
      element_ids: matrixIds,
      position,
      columns: matrixColumns,
    }
  }
  if (kind === 'array') {
    const resolvedInputType: SketchArrayInputType =
      inputType ??
      (label.toLowerCase() === 'text' ||
      label.toLowerCase().includes('str') ||
      label.toLowerCase().includes('word') ||
      (values.length > 0 && values.some((val) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(val)))
        ? 'character'
        : 'number')
    return { id, kind, label, values, element_ids: elementIds, position, input_type: resolvedInputType }
  }
  return { id, kind, label, values, element_ids: elementIds, position }
}
