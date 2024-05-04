import { store } from "../store/store";
import { useScrollDown } from "../hooks/use-scroll-down";

export function Completion() {
  useScrollDown();
  const li = document.createElement("li");
  li.className = "Completion";

  if (!store.completion.isVisible) {
    return li;
  }

  for (const element of store.completion.list) {
    const div = document.createElement("div");
    div.className = store.completion.selected === element ? "active" : "";
    div.innerText = element;
    li.appendChild(div);
  }

  return li;
}
