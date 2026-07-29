let clock: () => Date = () => new Date();

/** The single clock seam for audit dates and expiry decisions. */
export function now(): Date {
  return clock();
}

export function setClockForTests(next: (() => Date) | undefined): void {
  clock = next ?? (() => new Date());
}

export function dateLabel(epochMs: number): string {
  return clock().constructor === Date ? new Date(epochMs).toISOString().slice(0, 10) : "";
}
