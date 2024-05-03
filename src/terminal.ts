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
      const li = document.createElement("li");
      li.className = "Line";
      li.innerHTML = line.value;
      this.lines.appendChild(li);
    }
  }

  clear() {
    this.lines.innerHTML = "";
  }

  updateLast(line: OutputLine) {
    if (this.lines.lastElementChild) {
      this.lines.lastElementChild.innerHTML = line.value;
    }
  }
}

export const terminal = window.terminal = new Terminal(document.getElementById("root")!);
