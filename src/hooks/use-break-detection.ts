export function useBreakDetection(callback: () => void) {
  function detectBreak(e: KeyboardEvent) {
    if (e.key === "c" && e.ctrlKey) {
      callback();
    }
  }

  document.addEventListener("keydown", detectBreak);
}
