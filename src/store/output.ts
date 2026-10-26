import { CommandLine, OutputLine, TextLine } from "../types/line";
import { store } from "./store";
import { resolveConstants } from "../utils/constants";

export class Output {
  context = { command: "", args: [] as string[], pwd: "/root" };
  push(...lines: OutputLine[]) {
    window.terminal.push(...lines);
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
      this.push(textLine);
      return;
    }

    textLine.value = "";
    this.push(textLine);
    for (const letter of value) {
      await store.system.wait(35);
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
      await store.system.wait(25);
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
