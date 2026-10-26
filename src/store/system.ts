import { store } from "./store";
import { process } from "../utils/process";
import { sleep } from "../utils/sleep";
import { hashFromCommand } from "../utils/routes";

type SystemState = "processing" | "shutdown" | "freeze" | "interrupted" | "";

export class System {
  private _state: SystemState = "";
  private controller = new AbortController();
  private animationController = new AbortController();
  private skipped = false;
  private focusAfterCommand = false;
  animations = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  constructor() {
    try {
      const saved = localStorage.getItem("portfolio-animations");
      if (saved !== null) this.animations = saved === "true";
    } catch {
      /* Settings are optional when browser storage is unavailable. */
    }
    this.updateMotion();
  }

  set state(newState: SystemState) {
    this._state = newState;
    window.terminal.setBusy(this.isProcessing);
    if (this.isInputAllowed) window.terminal.showInput(this.focusAfterCommand);
    else window.terminal.hideInput();
  }

  get state() {
    return this._state;
  }
  get shutdown() {
    return this.state === "shutdown";
  }
  get isInputAllowed() {
    return this.state === "";
  }
  get isProcessing() {
    return this.state === "processing";
  }
  get shouldAnimate() {
    return this.animations && !this.skipped;
  }

  private updateMotion() {
    document.documentElement.dataset.animations = String(this.animations);
    const button = document.querySelector<HTMLButtonElement>(
      "[data-toggle-motion]",
    );
    if (button) {
      button.setAttribute("aria-pressed", String(this.animations));
      button.textContent = `Animations: ${this.animations ? "on" : "off"}`;
    }
  }

  toggleAnimations() {
    this.animations = !this.animations;
    if (!this.animations) this.skipAnimation();
    try {
      localStorage.setItem("portfolio-animations", String(this.animations));
    } catch {
      /* Optional preference. */
    }
    this.updateMotion();
  }

  skipAnimation() {
    this.skipped = true;
    this.animationController.abort();
  }

  wait(ms: number) {
    return this.shouldAnimate
      ? sleep(
          ms,
          AbortSignal.any([
            this.controller.signal,
            this.animationController.signal,
          ]),
        )
      : Promise.resolve();
  }

  async break() {
    if (this.isProcessing) {
      this.state = "interrupted";
      this.controller.abort();
    } else if (this.isInputAllowed) {
      store.history.set("");
      window.terminal.resetInput();
    }
  }

  setShutdown() {
    this.state = "shutdown";
    window.terminal.shutdown();
  }

  setFreeze() {
    this.state = "freeze";
  }

  async addCommand(
    command: string,
    options: { focus?: boolean; startup?: boolean; route?: boolean } = {},
  ) {
    if (!this.isInputAllowed || !command.trim()) return;
    this.focusAfterCommand = options.focus ?? false;
    this.controller = new AbortController();
    this.animationController = new AbortController();
    this.skipped = false;
    store.history.set(command);
    store.history.add();
    store.completion.reset();
    this.state = "processing";
    const hash = hashFromCommand(command);
    if (hash && options.route !== false && location.hash !== hash) {
      if (options.startup) window.history.replaceState(null, "", hash);
      else window.history.pushState(null, "", hash);
    }
    window.terminal.setRoute(hash);
    try {
      await store.output.processCommandLine(command, options.startup);
      if (this.isProcessing) await process(command);
    } catch (error) {
      console.error("Command failed", error);
      store.output.push({
        value:
          '<span class="Error">Could not run this command. Try again or type <code>help</code>.</span>',
        style: {},
      });
    } finally {
      if (["processing", "interrupted"].includes(this.state)) this.state = "";
      window.terminal.announce(
        this.state === "" ? `Finished: ${command}` : "Terminal session ended.",
      );
    }
  }

  async start(commands: string[]) {
    for (const command of commands)
      await this.addCommand(command, { startup: true, route: false });
  }
}
