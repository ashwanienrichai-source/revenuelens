// lib/dataCubeStore.ts
// Persists the cleaned data cube in sessionStorage so it survives
// page navigation and soft refreshes within the same browser tab.
// The File object itself cannot be serialized — we store the CSV text
// and reconstruct a File on read.

const KEY = 'rl_data_cube'

export interface DataCubeMeta {
  fileName:     string
  datasetType:  string
  rowCount:     number
  columns:      string[]
  mapping:      Record<string, string>
  transforms:   string[]          // list of transformations applied e.g. ['fuzzy_consolidation']
  createdAt:    string            // ISO timestamp
}

export interface DataCube {
  meta:    DataCubeMeta
  csvText: string                 // full cleaned CSV as text
}

function isClient() {
  return typeof window !== 'undefined'
}

export const dataCubeStore = {

  save(cube: DataCube): void {
    if (!isClient()) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify(cube))
    } catch (e) {
      // sessionStorage can throw if quota exceeded (large files)
      console.warn('dataCubeStore: sessionStorage quota exceeded, falling back to memory')
      ;(dataCubeStore as any)._mem = cube
    }
  },

  load(): DataCube | null {
    if (!isClient()) return null
    try {
      const raw = sessionStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as DataCube
    } catch {}
    return (dataCubeStore as any)._mem ?? null
  },

  clear(): void {
    if (!isClient()) return
    try { sessionStorage.removeItem(KEY) } catch {}
    ;(dataCubeStore as any)._mem = null
  },

  hasData(): boolean {
    if (!isClient()) return false
    try {
      return !!sessionStorage.getItem(KEY)
    } catch {}
    return !!(dataCubeStore as any)._mem
  },

  // Reconstruct a File object from stored CSV text
  toFile(cube: DataCube): File {
    const blob = new Blob([cube.csvText], { type: 'text/csv' })
    return new File([blob], cube.meta.fileName, { type: 'text/csv' })
  },

  // Helper: build CSV text from rows + columns
  buildCsv(columns: string[], rows: Record<string, string>[]): string {
    const header = columns.join(',')
    const body   = rows.map(row =>
      columns.map(col => {
        const v = String(row[col] ?? '')
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"`
          : v
      }).join(',')
    ).join('\n')
    return header + '\n' + body
  },
}
