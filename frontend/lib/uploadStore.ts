// lib/uploadStore.ts
// In-memory store to pass file + mapping from upload wizard to command-center
// Lives in module scope — survives client-side navigation but not page refresh

let _file: File | null = null
let _columns: string[] = []
let _mapping: Record<string,string> = {}
let _datasetType: string = ''

export const uploadStore = {
  set(file: File, columns: string[], mapping: Record<string,string>, datasetType: string = '') {
    _file        = file
    _columns     = columns
    _mapping     = mapping
    _datasetType = datasetType
  },
  get() {
    return { file: _file, columns: _columns, mapping: _mapping, datasetType: _datasetType }
  },
  clear() {
    _file        = null
    _columns     = []
    _mapping     = {}
    _datasetType = ''
  },
  hasData() {
    return _file !== null && _columns.length > 0
  }
}
