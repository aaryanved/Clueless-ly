// Storage abstraction. The app depends on this interface, not on a concrete database,
// so the persistence layer can be swapped (JSON file today, SQLite later) without
// touching feature code.
export interface StorageAdapter {
  readJson<T>(key: string): Promise<T | null>
  writeJson<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
}
