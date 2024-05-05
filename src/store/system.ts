import { store } from "./store";
import { process } from "../utils/process";
import escape from "lodash/escape";

type SystemState = "processing" | "shutdown" | "freeze" | "interrupted" | "";

export class System {
  private _state: SystemState = "";

  set state(newState: SystemState) {
    this._state = newState;
    if (this.isInputAllowed) {
      window.terminal.showInput(); 
    } else {
      window.terminal.hideInput();
    }
  }

  get state(): SystemState {
    return this._state;
  }

  get shutdown(): boolean {
    return this.state === "shutdown";
  }

  get isInputAllowed(): boolean {
    return this.state === "";
  }

  get isProcessing(): boolean {
    return this.state === "processing";
  }

  startProcessing(): void {
    this.state = "processing";
  }

  stopProcessing(): void {
    if (["processing", "interrupted"].includes(this.state)) {
      this.state = "";
    }
  }

  async break() {
    if (this.state === "processing") {
      this.state = "interrupted";
    } else if (this.state === "") {
      const value = store.history.value;
      store.history.set("");
      await this.processNothing(value);
    }
  }

  setShutdown(): void {
    this.state = "shutdown";
    window.terminal.shutdown();
  }

  setFreeze(): void {
    this.state = "freeze";
  }

  async addCommand(command: string): Promise<void> {
    store.system.startProcessing();
    await store.output.processCommandLine(command);
    await process(escape(command));
    store.system.stopProcessing();
  }

  async processNothing(command: string): Promise<void> {
    store.system.startProcessing();
    await store.output.processCommandLine(command);
    await process("");
    store.system.stopProcessing();
  }

  async start(startCommands: string[]): Promise<void> {
    store.system.startProcessing();
    for (const command of startCommands) {
      store.history.set(command);
      store.history.add();
      await store.output.processCommandLine(command, true);
      await process(command);
      if (!store.system.isProcessing) break;
    }
    store.system.stopProcessing();
  }
}
