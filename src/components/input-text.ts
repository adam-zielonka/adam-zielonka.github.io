type InputTextProps = {
  value: string
  start: number
  end: number
}

export function InputText({ value, start, end }: InputTextProps) {
  const isSelection = start !== end;
  const newEnd = end + (isSelection ? 0 : 1);
  const newValue = value.replace(/ /g, "\u00a0");

  const beforeText = newValue.slice(0, start);
  const text = newValue.slice(start, newEnd) || "\u00a0";
  const afterText = newValue.slice(newEnd);

  const span = document.createElement("span");
  span.className = "InputText";
  span.append(beforeText);

  const selection = document.createElement("span");
  selection.className = isSelection ? "selection" : "caret";
  selection.innerHTML = text;
  span.append(selection);

  span.append(afterText);
  return span;
}
