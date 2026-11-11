import { store } from "./store";
import { process } from "../utils/process";
import { sleep } from "../utils/sleep";
import { hashFromCommand } from "../utils/routes";
import { parseArgs } from "../utils/args";
import { requestPowerOnBoot } from "../utils/boot";

type SystemState =
  | "processing"
  | "shutdown"
  | "off"
  | "freeze"
  | "interrupted"
  | "";

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
    window.terminal.setDiskActivity(
      this.isProcessing ? "busy" : this.isInputAllowed ? "idle" : "off",
    );
    if (this.isInputAllowed) window.terminal.showInput(this.focusAfterCommand);
    else window.terminal.hideInput();
  }

  get state() {
    return this._state;
  }
  get shutdown() {
    return this.state === "shutdown";
  }
  get isPoweredOff() {
    return this.state === "off";
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
  get isAnimationSkipped() {
    return this.skipped;
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

  togglePower() {
    if (this.isPoweredOff) {
      requestPowerOnBoot();
      window.location.reload();
      return;
    }
    // Mark the session off before aborting, so pending commands cannot revive it.
    this.state = "off";
    this.controller.abort();
    this.animationController.abort();
    window.terminal.powerOff();
    window.terminal.announce(
      "Computer powered off. Use the power button to turn it on.",
    );
  }

  setFreeze() {
    this.state = "freeze";
  }

  async addCommand(
    command: string,
    options: {
      focus?: boolean;
      startup?: boolean;
      route?: boolean;
      animateCommand?: boolean;
    } = {},
  ) {
    if (!this.isInputAllowed || !command.trim()) return false;
    const desktopShutdown =
      window.terminal.isWindows &&
      ["shutdown", "exit"].includes(parseArgs(command)[0]);
    if (!desktopShutdown) window.terminal.closeWindows();
    this.focusAfterCommand = options.focus ?? false;
    this.controller = new AbortController();
    this.animationController = new AbortController();
    this.skipped = false;
    const automaticBoot =
      options.startup === true && ["boot", "windows"].includes(command);
    if (!automaticBoot) {
      store.history.set(command);
      store.history.add();
    }
    store.completion.reset();
    this.state = "processing";
    const hash = hashFromCommand(command);
    if (hash && options.route !== false && location.hash !== hash) {
      if (options.startup) window.history.replaceState(null, "", hash);
      else window.history.pushState(null, "", hash);
    }
    window.terminal.setRoute(hash);
    let completed = false;
    try {
      // A power-on starts the boot screen immediately, without a shell prompt.
      if (!automaticBoot && !desktopShutdown)
        await store.output.processCommandLine(
          command,
          options.animateCommand ?? true,
        );
      if (this.isProcessing) await process(command);
      // Reduced motion shows every message at once, until the visitor dismisses it.
      if (this.isProcessing && window.terminal.isStaticMatrix) {
        await new Promise<void>(resolve => {
          if (this.controller.signal.aborted) resolve();
          else
            this.controller.signal.addEventListener("abort", () => resolve(), {
              once: true,
            });
        });
      }
      completed = this.isProcessing;
    } catch (error) {
      console.error("Command failed", error);
      store.output.push({
        value:
          '<span class="Error">Could not run this command. Try again or type <code>help</code>.</span>',
        style: {},
      });
    } finally {
      window.terminal.finishExperience();
      if (["processing", "interrupted"].includes(this.state)) this.state = "";
      if (!this.isPoweredOff)
        window.terminal.announce(
          this.state === ""
            ? `Finished: ${command}`
            : "Terminal session ended.",
        );
    }
    return completed;
  }

  async start(commands: string[]) {
    for (const command of commands) {
      const completed = await this.addCommand(command, {
        startup: true,
        route: false,
      });
      if (!completed) break;
    }
  }
}
