import { Input } from "./components/input";
import { Line } from "./components/line";
import { Experience, ExperienceKind } from "./components/experience";
import { useBreakDetection } from "./hooks/use-break-detection";
import { OutputLine } from "./types/line";
import { isCommandLine } from "./utils/line";

export class Terminal {
  private lines = document.createElement("ul");
  private output = document.createElement("div");
  private inputHost = document.createElement("div");
  private lastCommand?: HTMLElement;
  private input?: ReturnType<typeof Input>;
  private experience?: ReturnType<typeof Experience>;
  private experienceKind?: ExperienceKind;
  private staticMatrix = false;

  get isStaticMatrix() {
    return this.experienceKind === "matrix" && this.staticMatrix;
  }

  private get activeLines() {
    return this.experience?.lines ?? this.lines;
  }

  constructor(private root: HTMLElement) {
    this.root.replaceChildren();
    this.root.className = "Terminal";
    this.output.className = "TerminalOutput";
    this.output.tabIndex = 0;
    this.output.setAttribute("role", "region");
    this.output.setAttribute("aria-label", "Terminal output");
    this.output.append(this.lines);
    this.inputHost.className = "InputHost";
    this.root.append(this.output, this.inputHost);
    useBreakDetection(this.root, () => void window.store.system.break());
  }

  push(...lines: OutputLine[]) {
    for (const line of lines) {
      if (
        this.experienceKind === "matrix" &&
        !isCommandLine(line) &&
        line.value === "&nbsp;"
      )
        continue;
      const element = Line({ line });
      this.activeLines.append(element);
      if (isCommandLine(line)) this.lastCommand = element;
    }
  }

  clear() {
    if (this.experienceKind === "matrix") {
      if (!this.staticMatrix) this.activeLines.replaceChildren();
      return;
    }
    if (this.output.contains(document.activeElement))
      this.output.focus({ preventScroll: true });
    this.lines.replaceChildren();
    this.lastCommand = undefined;
    this.output.scrollTop = 0;
  }

  updateLast(line: OutputLine) {
    this.activeLines.lastElementChild?.replaceWith(Line({ line }));
    if (isCommandLine(line))
      this.lastCommand = this.activeLines.lastElementChild as HTMLElement;
  }

  setBusy(busy: boolean) {
    this.root.setAttribute("aria-busy", String(busy));
    const skip = document.querySelector<HTMLButtonElement>(
      "[data-skip-animation]",
    );
    if (skip) skip.hidden = !busy;
    this.inputHost.dataset.busy = String(busy);
    if (!busy && this.lastCommand)
      this.output.scrollTop = this.lastCommand.offsetTop - 24;
  }

  setRoute(hash?: string) {
    if (!hash) return;
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      ".SiteNav a",
    )) {
      const active =
        link.hash === hash ||
        (link.hash === "#projects" && hash.startsWith("#project/"));
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  announce(message: string) {
    const status = document.getElementById("command-status");
    if (status) status.textContent = message;
  }

  shutdown() {
    this.openExperience("shutdown");
  }

  enterMatrix() {
    this.staticMatrix = !window.store.system.shouldAnimate;
    this.openExperience("matrix");
  }

  private openExperience(kind: ExperienceKind) {
    this.closeExperience();
    this.experienceKind = kind;
    this.experience = Experience(kind, () => {
      if (kind === "shutdown") window.location.reload();
      else void window.store.system.break();
    });
    useBreakDetection(this.experience.dialog, () => {
      if (kind === "matrix") void window.store.system.break();
    });
    document.body.append(this.experience.dialog);
    document.body.classList.add("has-experience");
    this.experience.dialog.showModal();
    this.experience.dialog.focus({ preventScroll: true });
  }

  finishExperience() {
    if (this.experienceKind === "matrix") this.closeExperience();
  }

  private closeExperience() {
    this.experience?.dialog.close();
    this.experience?.dialog.remove();
    this.experience = undefined;
    this.experienceKind = undefined;
    document.body.classList.remove("has-experience");
  }
  font(font: string) {
    this.root.style.fontFamily = font;
  }
  resetInput() {
    this.input?.reset();
  }
  hideInput() {
    if (this.inputHost.contains(document.activeElement))
      this.output.focus({ preventScroll: true });
    this.inputHost.replaceChildren();
    this.input = undefined;
  }
  showInput(focus = false) {
    if (!this.input) {
      this.input = Input();
      this.inputHost.replaceChildren(this.input.element);
    }
    if (focus) this.input.focus();
  }
}

export const terminal = (window.terminal = new Terminal(
  document.getElementById("root")!,
));
