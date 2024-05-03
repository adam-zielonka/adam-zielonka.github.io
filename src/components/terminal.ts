import { observer } from "mobx-react-lite";
import { store } from "../store/store";
import { Completion } from "./completion";
import { Lines } from "./lines";
import { Input } from "./input";
import { useBreakDetection } from "../hooks/use-break-detection";
import { Shutdown } from "./shutdown";

export const Terminal = observer(() => {
  useBreakDetection(() => void store.system.break());

  if (store.system.shutdown) {
    return <Shutdown/>;
  }

  return <div className="Terminal" style={{fontFamily: store.style.font}}>
    <ul>
      <Lines/>
      {store.system.isInputAllowed && <Input/>}
      <Completion/> 
    </ul>
  </div>;
});
