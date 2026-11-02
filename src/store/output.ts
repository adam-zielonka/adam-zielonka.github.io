import { CommandLine, OutputLine, TextLine } from "../types/line";
import { store } from "./store";
import { resolveConstants } from "../utils/constants";
import { outputSteps } from "../utils/output-steps";

export class Output {
  context = { command: "", args: [] as string[], pwd: "/root" };
  push(...lines: OutputLine[]) {
    return window.terminal.push(...lines);
  }

  clear(): void {
    window.terminal.clear();
  }

  updateLast(line: OutputLine): void {
    window.terminal.updateLast(line);
  }

  async processLine(line: TextLine, animate = false): Promise<void> {
    if (!store.system.isProcessing) return;
    const value = resolveConstants(line.value, this.context);

    const textLine: TextLine = {
      ...line,
      value,
    };

    if (!animate || !store.system.shouldAnimate || value.includes("<")) {
      const [element] = this.push(textLine);
      if (element && store.system.shouldAnimate && !window.terminal.isMatrix)
        await this.reveal(element);
      return;
    }

    textLine.value = "";
    this.push(textLine);
    for (const letter of value) {
      await store.system.wait(100);
      if (!store.system.isProcessing) return;
      if (!store.system.shouldAnimate) {
        textLine.value = value;
        this.updateLast(textLine);
        return;
      }
      textLine.value += letter;
      this.updateLast(textLine);
    }
  }

  private async reveal(element: HTMLElement) {
    const steps = outputSteps(element);
    for (const step of steps) step.hidden = true;
    try {
      for (const step of steps) {
        await store.system.wait(80);
        if (!store.system.isProcessing) return;
        step.hidden = false;
      }
    } finally {
      // Interrupted commands leave only the output already printed.
      for (const step of steps) {
        if (step.hidden) {
          if (store.system.isProcessing) step.hidden = false;
          else step.remove();
        }
      }
    }
  }

  async processCommandLine(command: string, animate = false): Promise<void> {
    if (!store.system.isProcessing) return;

    const commandLine: CommandLine = {
      value: command,
      blink: false,
      path: store.path.value,
    };

    if (!animate || !store.system.shouldAnimate) {
      this.push(commandLine);
      return;
    }

    commandLine.value = "";
    commandLine.blink = true;
    this.push(commandLine);
    for (const letter of command) {
      await store.system.wait(50);
      if (!store.system.isProcessing) break;
      if (!store.system.shouldAnimate) {
        commandLine.value = command;
        break;
      }
      commandLine.value += letter;
      this.updateLast(commandLine);
    }
    commandLine.blink = false;
    this.updateLast(commandLine);
  }
}
