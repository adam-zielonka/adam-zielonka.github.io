export function useBreakDetection(root: HTMLElement, callback: () => void) {
  root.addEventListener("keydown", event => {
    const input =
      event.target instanceof HTMLInputElement ? event.target : null;
    const hasInputSelection =
      input && input.selectionStart !== input.selectionEnd;
    if (
      event.key === "c" &&
      event.ctrlKey &&
      !hasInputSelection &&
      !window.getSelection()?.toString()
    ) {
      event.preventDefault();
      callback();
    }
  });
}
