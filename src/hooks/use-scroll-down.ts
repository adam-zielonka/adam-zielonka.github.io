export function useScrollDown() {
  setTimeout(() => window.scrollTo(0, document.body.scrollHeight));
}
