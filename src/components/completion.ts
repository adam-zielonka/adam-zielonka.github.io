import cx from "classnames";
import { observer } from "mobx-react-lite";
import { store } from "../store/store";
import { useScrollDown } from "../hooks/use-scroll-down";

export const Completion = observer(() => {
  if (!store.completion.isVisible) {
    return null;
  }

  return <li className="Completion">
    {store.completion.list.map(completion => <Element key={completion} value={completion}/> )}
  </li>;
});

const Element = observer(({ value }:{ value: string }) => {
  useScrollDown();

  return <div className={cx({active: store.completion.selected === value})}>
    {value}
  </div>;
});
