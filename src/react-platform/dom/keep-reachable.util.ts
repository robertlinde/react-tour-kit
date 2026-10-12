const blockingAttributes = ['aria-hidden', 'inert'];

/**
 * Keeps `element` and its ancestors below `<body>` free of `aria-hidden` and `inert`, until the
 * returned cleanup runs. Modal libraries put these on everything outside their own dialog (Radix
 * sets `aria-hidden`, others `inert`), also on the tour, which would hide it from screen readers or
 * block it; while it is open, the tour is the topmost modal.
 */
export function keepReachable(element: Element): () => void {
  const elements: Element[] = [];
  for (
    let current: Element | null = element;
    current && current !== document.body && current !== document.documentElement;
    current = current.parentElement
  ) {
    elements.push(current);
  }

  const clear = (target: Element): void => {
    for (const name of blockingAttributes) {
      target.removeAttribute(name);
    }
  };

  for (const target of elements) {
    clear(target);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof Element) {
        clear(record.target);
      }
    }
  });
  for (const target of elements) {
    observer.observe(target, {attributes: true, attributeFilter: blockingAttributes});
  }

  return () => {
    observer.disconnect();
  };
}
