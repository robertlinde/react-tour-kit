/**
 * Finds the first visible element matching the selector.
 * Important for layouts with duplicate DOM (e.g., mobile/desktop navigation).
 */
export function findVisibleElement(selector: string): Element | undefined {
  const allMatches = document.querySelectorAll(selector);

  for (const element of allMatches) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return element;
    }
  }

  return allMatches[0] ?? null;
}
