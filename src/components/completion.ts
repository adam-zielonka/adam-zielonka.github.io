import { store } from "../store/store";

export function Completion() {
  const list = document.createElement("div");
  list.className = "Completion";
  list.setAttribute("aria-label", "Command suggestions");
  if (!store.completion.isVisible) return list;
  for (const command of store.completion.list) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.complete = command;
    button.className = store.completion.selected === command ? "active" : "";
    button.setAttribute(
      "aria-pressed",
      String(store.completion.selected === command),
    );
    button.textContent = command;
    list.append(button);
  }
  return list;
}
