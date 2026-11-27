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
  /**
   * Set when Portfolio 98 hands over to the terminal (MS-DOS Prompt or
   * Restart in MS-DOS mode): `exit` and `win` then go back to Windows, with
   * the startup screen after MS-DOS mode and at once after the prompt.
   * Power-off and route navigation clear it.
   */
  returnToWindows?: "prompt" | "dos-mode";

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
    this.returnToWindows = undefined;
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

  /** Leaves Portfolio 98 for the terminal, which says how to come back. */
  exitToDos(kind: "prompt" | "dos-mode") {
    if (!this.isInputAllowed) return Promise.resolve(false);
    this.returnToWindows = kind;
    // Like a fresh MS-DOS session: no command at the prompt, just the output.
    return this.addCommand("dosmode", { focus: true, echo: false });
  }

  async addCommand(
    command: string,
    options: {
      focus?: boolean;
      startup?: boolean;
      route?: boolean;
      animateCommand?: boolean;
      /** Show the command at the prompt first (default). */
      echo?: boolean;
    } = {},
  ) {
    if (!this.isInputAllowed || !command.trim()) return false;
    const [name, ...args] = parseArgs(command);
    // After MS-DOS mode, `exit` and `win` return to Portfolio 98.
    const returning =
      ["exit", "win", "windows"].includes(name) && !args.length
        ? this.returnToWindows
        : undefined;
    if (["win", "windows"].includes(name) || returning)
      this.returnToWindows = undefined;
    const run = returning ? "windows" : command;
    // Shutting down or restarting the desktop keeps it on screen meanwhile.
    const desktopShutdown =
      window.terminal.isWindows &&
      ["shutdown", "exit", "restart"].includes(parseArgs(run)[0]);
    if (!desktopShutdown) window.terminal.closeWindows();
    this.focusAfterCommand = options.focus ?? false;
    this.controller = new AbortController();
    this.animationController = new AbortController();
    // The MS-DOS Prompt hands straight back, without the startup screen.
    this.skipped = returning === "prompt";
    const automaticBoot =
      options.startup === true && ["boot", "windows"].includes(run);
    if (!automaticBoot) {
      store.history.set(command);
      store.history.add();
    }
    store.completion.reset();
    this.state = "processing";
    const hash = hashFromCommand(run);
    if (hash && options.route !== false && location.hash !== hash) {
      if (options.startup) window.history.replaceState(null, "", hash);
      else window.history.pushState(null, "", hash);
    }
    window.terminal.setRoute(hash);
    let completed = false;
    try {
      // A power-on starts the boot screen immediately, without a shell prompt.
      if (!automaticBoot && !desktopShutdown && options.echo !== false)
        await store.output.processCommandLine(
          command,
          options.animateCommand ?? true,
        );
      if (this.isProcessing) await process(run);
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
      // An interrupted restart never reaches its new desktop: the old,
      // dimmed one goes too, as an interrupted `windows` leaves the prompt.
      if (
        desktopShutdown &&
        !completed &&
        !this.isPoweredOff &&
        parseArgs(run)[0] === "restart"
      )
        window.terminal.closeWindows();
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
