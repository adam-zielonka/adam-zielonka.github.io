import { Input } from "./components/input";
import { Line } from "./components/line";
import { Shutdown } from "./components/shutdown";
import { useBreakDetection } from "./hooks/use-break-detection";
import { OutputLine } from "./types/line";

export class Terminal {
  private lines: HTMLUListElement;
  private input?: ReturnType<typeof Input>;

  constructor(private root: HTMLElement) {
    this.root.innerHTML = "";
    this.root.className = "Terminal";

    this.lines = document.createElement("ul");
    this.root.appendChild(this.lines);

    useBreakDetection(() => void window.store.system.break());
  }

  push(...lines: OutputLine[]) {
    for (const line of lines) {
      this.lines.appendChild(Line({line}));
    }
  }

  clear() {
    this.lines.innerHTML = "";
  }

  updateLast(line: OutputLine) {
    if (this.lines.lastElementChild) {
      this.lines.lastElementChild.innerHTML = Line({line}).innerHTML;
    }
  }

  shutdown() {
    this.root.outerHTML = Shutdown().outerHTML;
  }

  font(font: string) {
    this.root.style.fontFamily = font;
  }

  hideInput() {
    if (this.input) {
      this.input.destroy();
      this.lines.removeChild(this.input.element);
      this.lines.removeChild(this.input.completion);
      this.input = undefined;
    }
  }

  showInput() {
    if (!this.input) {
      this.input = Input();
      this.lines.appendChild(this.input.element);
      this.lines.appendChild(this.input.completion);
    }
  }
}

export const terminal = window.terminal = new Terminal(document.getElementById("root")!);
