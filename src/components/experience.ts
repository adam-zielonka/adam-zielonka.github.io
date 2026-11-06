import { Shutdown } from "./shutdown";

export type ExperienceKind = "matrix" | "shutdown" | "boot";

export function Experience(kind: ExperienceKind, onDismiss: () => void) {
  const dialog = document.createElement("dialog");
  dialog.className = `Experience Experience--${kind}`;
  dialog.setAttribute("aria-labelledby", "experience-title");
  dialog.tabIndex = -1;
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (kind !== "shutdown") onDismiss();
  });
  dialog.addEventListener("keydown", event => {
    // show() does not provide the modal dialog's native Escape dismissal.
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      if (kind !== "shutdown") onDismiss();
    }
  });

  const lines = document.createElement("ul");
  lines.className = kind === "boot" ? "BootOutput" : "MatrixOutput";
  if (kind === "shutdown") {
    dialog.append(Shutdown());
  } else {
    const title = document.createElement("h2");
    title.id = "experience-title";
    title.className = "VisuallyHidden";
    title.textContent =
      kind === "boot" ? "Portfolio Linux startup" : "The Matrix";
    dialog.append(title, lines);
  }
  return { dialog, lines };
}
