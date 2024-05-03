import { LinePrefix } from "./line-prefix";
import { Caret } from "./caret";
import { OutputLine } from "../types/line";
import { isCommandLine } from "../utils/line";

export function Line({line}: {line: OutputLine}) {
  const li = document.createElement("li");
  li.className = "Line";
  setTimeout(() => window.scrollTo(0, document.body.scrollHeight));

  if (isCommandLine(line)) {
    const prefix = LinePrefix({path: line.path});
    li.appendChild(prefix);
    li.append(line.value);
    if (line.blink) {
      li.appendChild(Caret());
    }
    return li;
  }

  for (const [key, value] of Object.entries(line.style)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    li.style[key] = value;
  }
  li.innerHTML = line.value;
  return li;
}
