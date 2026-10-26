import { store } from "../store/store";
import { Completion } from "./completion";
import { LinePrefix } from "./line-prefix";

export function Input() {
  const { history, path, system, completion } = store;
  const form = document.createElement("form");
  form.className = "Input";
  form.setAttribute("aria-label", "Enter a terminal command");
  const row = document.createElement("div");
  row.className = "InputRow";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "command";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.enterKeyHint = "send";
  input.setAttribute("aria-label", "Terminal command");
  input.setAttribute("aria-describedby", "terminal-hint");
  input.placeholder = "Type help or choose a project…";
  input.value = history.value;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "SubmitCommand";
  submit.setAttribute("aria-label", "Run command");
  submit.innerHTML = '<span aria-hidden="true">↵</span>';
  const completionList = document.createElement("div");
  completionList.className = "CompletionHost";
  const updateCompletion = () => completionList.replaceChildren(Completion());
  const sync = () => {
    input.value = history.value;
    input.setSelectionRange(input.value.length, input.value.length);
    updateCompletion();
  };

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (completion.selected) {
      history.set(completion.selected + " ");
      completion.reset();
      sync();
      return;
    }
    void system.addCommand(input.value, {
      focus: document.activeElement === input,
    });
  });

  input.addEventListener("keydown", event => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
      return;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        if (event.key === "ArrowUp") history.up();
        else history.down();
        completion.reset();
        sync();
        break;
      case "Tab":
        // A second Tab previews choices; Shift+Tab and an empty prompt leave the input.
        if (event.shiftKey || !input.value.trim() || !completion.list.length)
          return;
        event.preventDefault();
        if (completion.theOne) {
          history.set(completion.theOne + " ");
          completion.reset();
        } else completion.next();
        sync();
        break;
      case "Escape":
        completion.reset();
        updateCompletion();
        break;
    }
  });
  input.addEventListener("input", () => {
    history.set(input.value);
    completion.reset();
    updateCompletion();
  });
  input.addEventListener("blur", () => {
    // Keep choices clickable until the click event has reached the document.
    setTimeout(() => {
      completion.reset();
      updateCompletion();
    }, 150);
  });
  completionList.addEventListener("click", event => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-complete]")
        : null;
    if (!target) return;
    history.set(target.dataset.complete + " ");
    completion.reset();
    sync();
    input.focus({ preventScroll: true });
  });
  row.append(LinePrefix({ path: path.value }), input, submit);
  form.append(completionList, row);
  return {
    element: form,
    focus: () => input.focus({ preventScroll: true }),
    reset: () => {
      completion.reset();
      sync();
    },
  };
}
