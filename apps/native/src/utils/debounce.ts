export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    const later = () => {
      timeoutId = undefined;
      func.apply(undefined, args);
    };

    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, wait);
  };
}
