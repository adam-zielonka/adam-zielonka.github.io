import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { store } from "../store/store";
import { LinePrefix } from "./line-prefix";
import { InputText } from "./input-text";
import { usePosition } from "../hooks/use-position";

export const Input = observer(() => {
  const { history, path, system, completion } = store;

  const inputRef = useRef<HTMLInputElement>(null);
  const [position, updatePosition] = usePosition(inputRef);

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

    inputRef.current?.focus();
    updatePosition();
  }

  function click(): void {
    inputRef.current?.focus();
    updatePosition();
  }

  useEffect(() => {
    document.addEventListener("keydown", keydown);
    document.addEventListener("click", click);

    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("click", click);
    };
  }, []);

  return <li className="Input">
    <LinePrefix path={path.value}/> <InputText value={history.value} start={position.start} end={position.end}/>
    <input
      ref={inputRef}
      value={history.value}
      onSelect={updatePosition}
      onKeyUp={updatePosition}
      onKeyDown={updatePosition}
      onChange={updatePosition}
      onInput={e => {
        history.set(e.currentTarget.value);
        updatePosition();
      }}
    />
  </li>;
});
