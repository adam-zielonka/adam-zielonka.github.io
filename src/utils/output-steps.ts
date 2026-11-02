// Reveal complete blocks so links, Markdown and ASCII art stay intact.
export function outputSteps(element: HTMLElement): HTMLElement[] {
  if (element.hidden) return [];
  const containers = ".Line, section, article, header, div";
  const groups =
    ".ProjectRow, .DetailHero, .OutputHeading, .DetailBreadcrumb, .OutputActions, .DetailLinks, .HelpList > div";
  const hasText = [...element.childNodes].some(
    node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );
  if (
    !element.matches(containers) ||
    element.matches(groups) ||
    !element.children.length ||
    hasText
  )
    return [element];
  return [...element.children].flatMap(child =>
    child instanceof HTMLElement ? outputSteps(child) : [],
  );
}
