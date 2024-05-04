import { LinePrefix } from "./line-prefix";
import { Caret } from "./caret";
import { OutputLine } from "../types/line";
import { isCommandLine } from "../utils/line";
import { useScrollDown } from "../hooks/use-scroll-down";

export function Line({line}: {line: OutputLine}) {
  useScrollDown();
  
  const li = document.createElement("li");
  li.className = "Line";

  if (isCommandLine(line)) {
    li.appendChild(LinePrefix({path: line.path}));
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
