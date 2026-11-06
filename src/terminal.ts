import { Input } from "./components/input";
import { Line } from "./components/line";
import { Experience, ExperienceKind } from "./components/experience";
import { useBreakDetection } from "./hooks/use-break-detection";
import { OutputLine } from "./types/line";
import { isCommandLine } from "./utils/line";
import { fitHomeProjects } from "./utils/home-layout";

export class Terminal {
  private lines = document.createElement("ul");
  private output = document.createElement("div");
  private inputHost = document.createElement("div");
  private input?: ReturnType<typeof Input>;
  private experience?: ReturnType<typeof Experience>;
  private experienceKind?: ExperienceKind;
  private experienceBackground: { element: HTMLElement; inert: boolean }[] = [];
  private staticMatrix = false;

  get isStaticMatrix() {
    return this.experienceKind === "matrix" && this.staticMatrix;
  }

  get isMatrix() {
    return this.experienceKind === "matrix";
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
    new ResizeObserver(() => {
      if (this.root.getAttribute("aria-busy") === "true") {
        this.scrollToEnd();
        return;
      }
      const atEnd =
        this.output.scrollTop + this.output.clientHeight >=
        this.output.scrollHeight - 2;
      this.fitHomeOutputs();
      if (atEnd) this.scrollToEnd();
    }).observe(this.output);
  }

  scrollToEnd() {
    const viewport = this.experience?.dialog ?? this.output;
    viewport.scrollTop = viewport.scrollHeight;
  }

  private fitHomeOutputs() {
    for (const home of this.lines.querySelectorAll<HTMLElement>(".HomeOutput"))
      fitHomeProjects(home, this.output);
  }

  push(...lines: OutputLine[]) {
    const elements: HTMLElement[] = [];
    for (const line of lines) {
      if (
        this.experienceKind === "matrix" &&
        !isCommandLine(line) &&
        line.value === "&nbsp;"
      )
        continue;
      const element = Line({ line });
      this.activeLines.append(element);
      elements.push(element);
      for (const home of element.querySelectorAll<HTMLElement>(".HomeOutput"))
        fitHomeProjects(home, this.output);
    }
    this.scrollToEnd();
    return elements;
  }

  clear() {
    if (this.experienceKind === "matrix") {
      if (!this.staticMatrix) this.activeLines.replaceChildren();
      return;
    }
    if (this.output.contains(document.activeElement))
      this.output.focus({ preventScroll: true });
    this.lines.replaceChildren();
    this.output.scrollTop = 0;
  }

  updateLast(line: OutputLine) {
    this.activeLines.lastElementChild?.replaceWith(Line({ line }));
    this.scrollToEnd();
  }

  setBusy(busy: boolean) {
    this.root.setAttribute("aria-busy", String(busy));
    const skip = document.querySelector<HTMLButtonElement>(
      "[data-skip-animation]",
    );
    if (skip) skip.hidden = !busy;
    this.inputHost.dataset.busy = String(busy);
    this.scrollToEnd();
  }

  setRoute(hash?: string) {
    if (!hash) return;
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      ".QuickCommands a",
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
    const system = window.store.system;
    this.staticMatrix = !system.shouldAnimate && !system.isAnimationSkipped;
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
    const screen = this.root.closest<HTMLElement>(".CRTScreen")!;
    this.experienceBackground = Array.from(screen.children)
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .map(element => ({ element, inert: element.inert }));
    for (const { element } of this.experienceBackground) element.inert = true;
    screen.append(this.experience.dialog);
    // Non-modal dialogs stay inside the CRT instead of entering the top layer.
    this.experience.dialog.show();
    this.experience.dialog.focus({ preventScroll: true });
  }

  finishExperience() {
    if (this.experienceKind === "matrix") this.closeExperience();
  }

  private closeExperience() {
    const restoreFocus = this.experience?.dialog.contains(
      document.activeElement,
    );
    this.experience?.dialog.close();
    this.experience?.dialog.remove();
    for (const { element, inert } of this.experienceBackground)
      element.inert = inert;
    this.experienceBackground = [];
    this.experience = undefined;
    this.experienceKind = undefined;
    if (restoreFocus) this.output.focus({ preventScroll: true });
  }
  font(font: string) {
    if (font) {
      this.root.style.fontFamily = font;
      this.root.style.setProperty("--terminal-font", font);
    } else {
      this.root.style.removeProperty("font-family");
      this.root.style.removeProperty("--terminal-font");
    }
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
    this.fitHomeOutputs();
    this.scrollToEnd();
    if (focus) this.input.focus();
  }
}

export const terminal = (window.terminal = new Terminal(
  document.getElementById("root")!,
));
