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


  // return <span className="InputText">
  //   {beforeText}<span className={isSelection ? "selection" : "caret"}>{text}</span>{afterText}
  // </span>;

  const span = document.createElement("span");
  span.className = "InputText";

  const beforeSpan = document.createElement("span");
  beforeSpan.innerHTML = beforeText;
  span.appendChild(beforeSpan);

  const selectionSpan = document.createElement("span");
  selectionSpan.className = "selection";
  selectionSpan.innerHTML = text;
  span.appendChild(selectionSpan);

  const afterSpan = document.createElement("span");
  afterSpan.innerHTML = afterText;
  span.appendChild(afterSpan);

  return span;
}
