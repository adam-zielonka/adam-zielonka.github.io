import fs from "fs";
import { parseLines } from "../utils/parse";
import { PluginOption } from "vite";

type Clock = (delay?: number) => number
type ResetClock = () => void

function createClock(clock = 0): [Clock, ResetClock] {
  return [
    (delay = 0) => (clock += delay),
    () => (clock = 0),
  ];
}

function randomLetter(): string {
  return String.fromCharCode(Math.floor(Math.random() * 26) + 97);
}

function splitMap(text: string, fn: (letter: string) => string): string {
  return text.split("").map(fn).join("");
}

function renderLinePrefix(): string {
  return (
    splitMap(
      "root@adam-zielonka",
      letter =>
        `<div class="user" style="animation: hidden ${clock()}ms;">${letter}</div>` +
        `<div class="hidden">${randomLetter()}</div>`,
    ) + `<div class="user-end" style="animation: hidden ${clock()}ms;">:~#&nbsp;</div>`
  );
}

function calculateBlinkCount(startTime: number, endTime: number): number {
  const blinkTime = 500;
  return Math.ceil((endTime - startTime) / blinkTime) + 2;
}

function renderCommandLine(command: string): string {
  const linePrefix = renderLinePrefix();
  const startTime = clock();

  clock(1000);

  const lineCommand = splitMap(
    command,
    letter =>
      `<div class="user-end" style="animation: hidden ${clock(50)}ms;">${letter}</div>`,
  );
  const blinkTimes = calculateBlinkCount(startTime, clock());
  const caret = `<div class="blink" style="animation: blink 500ms linear ${startTime}ms ${blinkTimes};">_</div>`;

  clock(1000);

  return `<li>${linePrefix}${lineCommand}${caret}</li>`;
}

function renderLines(command: string): string {
  const body = fs
    .readFileSync(`./src/commands/${command}.md`, "utf8")
    .replace(/---[ \s\S]*---\n/, "");

  const lines = parseLines(body).map(
    line => `<li style="animation: hidden ${clock(20)}ms;">${line.value}</li>`,
  );

  lines.shift();
  return lines.join("");
}

function renderCommand(command: string): string {
  return renderCommandLine(command) + renderLines(command);
}

function addIntent(line: string, level: number): string {
  return "  ".repeat(level) + line;
}

function formatHtml(html: string): string {
  const textLines = html.replace(/((li)|(div)|(ul))>/g, "$1>\n").split("\n");
  let level = 3;
  const lines = textLines.map(line => {
    if (line.match(/^.+<\//)) {
      return addIntent(line, level);
    }
    if (line.match(/^<\//)) {
      return addIntent(line, --level);
    }
    if (line.match(/\/>$/)) {
      return addIntent(line, level);
    }
    return addIntent(line, level++);
  });
  return lines.join("\n").trimStart();
}

const [clock, resetClock] = createClock();

export const noScript: PluginOption = {
  name: "no-script-section",
  transformIndexHtml(html) {
    resetClock();
    return html.replace(/<links \/>/g, formatHtml(
      "<ul>" +
        renderCommand("whoami") +
        renderCommandLine("") +
        renderLines("panic") +
      "</ul>"
    )).replace(/\n\s*\n/g, "\n");
  },
};
