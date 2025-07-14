export interface EventTypes {
  data: (chunk: Uint8Array) => void
  end: () => void
  error: (err: Error) => void
}
