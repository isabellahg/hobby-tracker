export interface OperationContext {
  now: Date
  dryRun: boolean
}

export function makeContext(overrides: Partial<OperationContext> = {}): OperationContext {
  return { now: new Date(), dryRun: false, ...overrides }
}
