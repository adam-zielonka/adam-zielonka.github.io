import { store } from "../store/store";
import { InputText } from "./input-text";
import { LinePrefix } from "./line-prefix";

export const Input = () => {
  const { history, path, system, completion } = store;

  const prefix = LinePrefix({path: path.value});
  const inputText = InputText({value: history.value, start: 0, end: 0});
  const input = document.createElement("input");

  const updatePosition = () => {
    inputText.innerHTML = InputText({
      value: input.value, 
      start: input.selectionStart ?? 0, 
      end: input.selectionEnd ?? 0,
    }).innerHTML;
  };

  function keydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "Enter":
        if (completion.selected) {
          history.set(completion.selected + " ");
          completion.reset();
        } else {
          completion.reset();
          void system.addCommand(history.value);
          history.add();
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        history.up();
        completion.reset();
        break;
      case "ArrowDown":
        event.preventDefault();
        history.down();
        completion.reset();
        break;
      case "Tab":
        event.preventDefault();
        if (completion.theOne) {
          history.set(completion.theOne + " ");
          completion.reset();
        } else {
          completion.next(); 
        }
        break;
    }

    input.value = history.value;
    input.focus();
    updatePosition();
  }

  function click(): void {
    input.focus();
    updatePosition();
  }

  // useEffect(() => {
  document.addEventListener("keydown", keydown);
  document.addEventListener("click", click);

  //   return () => {
  //     document.removeEventListener("keydown", keydown);
  //     document.removeEventListener("click", click);
  //   };
  // }, []);

  input.onselect = updatePosition;
  input.onkeyup = updatePosition;
  input.onkeydown = updatePosition;
  input.onchange = updatePosition;
  input.oninput = () => {
    history.set(input.value);
    updatePosition();
  };
  
  const li = document.createElement("li");
  li.className = "Input";
  li.appendChild(prefix);
  li.appendChild(inputText);
  li.appendChild(input);
  return li;
};
