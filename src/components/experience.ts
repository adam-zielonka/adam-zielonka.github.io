import { Shutdown } from "./shutdown";

export type ExperienceKind = "matrix" | "shutdown";

export function Experience(kind: ExperienceKind, onDismiss: () => void) {
  const dialog = document.createElement("dialog");
  dialog.className = `Experience Experience--${kind}`;
  dialog.setAttribute("aria-labelledby", "experience-title");
  dialog.tabIndex = -1;
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    onDismiss();
  });
  dialog.addEventListener("keydown", event => {
    // show() does not provide the modal dialog's native Escape dismissal.
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    }
  });

  const lines = document.createElement("ul");
  lines.className = "MatrixOutput";
  if (kind === "shutdown") {
    dialog.append(Shutdown());
  } else {
    const title = document.createElement("h2");
    title.id = "experience-title";
    title.className = "VisuallyHidden";
    title.textContent = "The Matrix";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ExperienceClose";
    close.textContent = "Back to portfolio · Esc";
    close.addEventListener("click", onDismiss);
    dialog.append(title, lines, close);
  }
  return { dialog, lines };
}
