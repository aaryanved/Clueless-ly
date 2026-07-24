import type { CluelessApi } from './index'

declare global {
  interface Window {
    clueless: CluelessApi
  }
}

export {}
