import { CommandLine, OutputLine, TextLine } from "../types/line";
import { sleep } from "../utils/sleep";
import { store } from "./store";

export class Output {
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
    await sleep(20);
    if (!store.system.isProcessing) return;

    const [command, ...args] = store.history.lastCommand.split(" ");
    const value = line.value
      .replace(/<a.*const:command.*<\/a>/, command)
      .replace(/<a.*const:args.*>(.*)<\/a>/, args.join(" ") || "$1")
      .replace(/<a.*const:pwd.*<\/a>/, store.path.pwd);

    const textLine: TextLine = {
      ...line,
      value,
    };

    if (!animate) {
      this.push(textLine);
      return;
    }

    textLine.value = "";
    this.push(textLine);
    for (const letter of value) {
      await sleep(100);
      if (!store.system.isProcessing) return;
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

    if (!animate) {
      this.push(commandLine);
      return;
    }

    commandLine.value = "";
    commandLine.blink = true;
    this.push(commandLine);
    for (const letter of command) {
      await sleep(50);
      if (!store.system.isProcessing) break;
      commandLine.value += letter;
      this.updateLast(commandLine);
    }
    await sleep(1000);
    commandLine.blink = false;
    this.updateLast(commandLine);
  }
}
