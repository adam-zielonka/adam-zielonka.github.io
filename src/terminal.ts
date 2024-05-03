import { Line } from "./components/line";
import { Shutdown } from "./components/shutdown";
import { OutputLine } from "./types/line";

export class Terminal {
  private lines: HTMLUListElement;

  constructor(private root: HTMLElement) {
    this.root.innerHTML = "";
    this.root.className = "Terminal";

    this.lines = document.createElement("ul");
    this.root.appendChild(this.lines);
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
}

export const terminal = window.terminal = new Terminal(document.getElementById("root")!);
