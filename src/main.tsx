document.querySelector("#noscript")?.remove();

import { store } from "./store/store";
import { OutputLine } from "./types/line";

import.meta.glob("./styles/*.scss", { eager: true });

export class Terminal {
  private lines: HTMLUListElement;

  constructor(private root: HTMLElement) {
    this.root.innerHTML = "";
    this.root.className = "Terminal";

    this.lines = document.createElement("ul");
    this.root.appendChild(this.lines);

    const line = document.createElement("li");
    line.innerText = "Loading...";
    this.lines.appendChild(line);
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

window.terminal = new Terminal(document.getElementById("root")!);
void store.system.start(["whoami"]);
