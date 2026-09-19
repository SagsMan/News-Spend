export function* chunkArray<T>(arr: T[], size: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}
