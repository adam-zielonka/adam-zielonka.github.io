import { parseMnemonic } from "./menu";
import { messageBox } from "./message-box";

export type ShutDownChoice = "standby" | "shutdown" | "restart" | "dos-mode";

const choices: { value: ShutDownChoice; label: string }[] = [
  { value: "standby", label: "S&tand by" },
  { value: "shutdown", label: "&Shut down" },
  { value: "restart", label: "&Restart" },
  { value: "dos-mode", label: "Restart in &MS-DOS mode" },
];

const HELP = [
  "Stand by blanks the screen until you press a key or click.",
  "Shut down closes Portfolio 98 so that you can turn off the computer.",
  "Restart closes Portfolio 98 and starts it again.",
  "Restart in MS-DOS mode returns to the terminal; type EXIT there to come back.",
].join("\n");

/** Windows remembers the last choice; so does this page, until it reloads. */
let lastChoice: ShutDownChoice = "shutdown";

let dialogCount = 0;

/**
 * Start ▸ Shut Down…: dims the whole desktop with a dither and asks what
 * to do. Stand by is handled here; the other choices go to onChoice.
 */
export function createShutDown({
  root,
  start,
  signal,
  onChoice,
}: {
  root: HTMLElement;
  start: HTMLButtonElement;
  signal: AbortSignal;
  onChoice: (choice: Exclude<ShutDownChoice, "standby">) => void;
}) {
  let open = false;

  function dim() {
    const dither = document.createElement("div");
    dither.className = "WinDither";
    dither.setAttribute("aria-hidden", "true");
    root.append(dither);
    root.dataset.shutdownDither = "";
    return () => {
      dither.remove();
      delete root.dataset.shutdownDither;
    };
  }

  function form() {
    const name = `win-shutdown-${++dialogCount}`;
    const body = document.createElement("div");
    body.className = "WinShutDown";
    body.innerHTML = `<p id="${name}-prompt">What do you want the computer to do?</p><fieldset><legend class="VisuallyHidden">Shut down options</legend>${choices
      .map(
        ({ value, label }) =>
          `<label><input type="radio" name="${name}" value="${value}"${value === lastChoice ? " checked" : ""}><span>${parseMnemonic(label).html}</span></label>`,
      )
      .join("")}</fieldset>`;
    return body;
  }

  /** Opens the dialog, unless it is already open. */
  async function show() {
    if (open || signal.aborted) return;
    open = true;
    const undim = dim();
    const body = form();
    const radios = [
      ...body.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    const selected = () =>
      (radios.find(radio => radio.checked)?.value ??
        "shutdown") as ShutDownChoice;
    const result = messageBox({
      title: "Shut Down Portfolio 98",
      icon: "shutdown",
      body,
      role: "dialog",
      host: root,
      returnFocus: start,
      initialFocus: radios.find(radio => radio.checked),
      buttons: [
        { id: "ok", label: "OK", default: true },
        { id: "cancel", label: "Cancel", cancel: true },
        { id: "help", label: "Help" },
      ],
      onButton: id => {
        if (id !== "help") return;
        void messageBox({
          title: "Shut Down Help",
          icon: "info",
          body: HELP,
          host: root,
        });
        return false;
      },
      signal,
    });
    const box = body.closest<HTMLElement>(".WinMessageBox");
    // The prompt describes the dialog; the radios speak for themselves.
    box?.setAttribute("aria-describedby", body.querySelector("p")!.id);
    // Dialog mnemonics work without Alt while focus is not in a text field.
    const keys = choices.map(choice => parseMnemonic(choice.label).key);
    box?.addEventListener(
      "keydown",
      event => {
        if (event.ctrlKey || event.metaKey || event.key.length !== 1) return;
        const index = keys.indexOf(event.key.toLowerCase());
        if (index < 0) return;
        event.preventDefault();
        radios[index].checked = true;
        radios[index].focus({ preventScroll: true });
      },
      { signal },
    );
    const button = await result;
    open = false;
    const choice = selected();
    if (button !== "ok" || signal.aborted) {
      undim();
      return;
    }
    lastChoice = choice;
    if (choice === "standby") {
      undim();
      standBy();
    } else onChoice(choice);
  }

  /**
   * Blanks the screen; the CRT shows its stand-by light while
   * .CRTScreen[data-standby] is set. Any key or press wakes the desktop.
   */
  function standBy() {
    const screen = root.closest<HTMLElement>(".CRTScreen");
    const overlay = document.createElement("div");
    const id = `win-standby-${++dialogCount}`;
    overlay.className = "WinStandby";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Stand by");
    overlay.setAttribute("aria-describedby", id);
    overlay.innerHTML = `<p class="VisuallyHidden" id="${id}">Portfolio 98 is on stand by. Press any key or click to resume.</p>`;
    const background = [...root.children]
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .map(element => ({ element, inert: element.inert }));
    for (const { element } of background) element.inert = true;
    const previous =
      document.activeElement instanceof HTMLElement &&
      root.contains(document.activeElement)
        ? document.activeElement
        : start;
    root.append(overlay);
    if (screen) screen.dataset.standby = "";
    overlay.focus({ preventScroll: true });

    const listeners = new AbortController();
    const resume = () => {
      listeners.abort();
      overlay.remove();
      if (screen) delete screen.dataset.standby;
      for (const { element, inert } of background) element.inert = inert;
    };
    const wake = (event: Event) => {
      // The waking key or press does nothing else, as on a real machine.
      event.preventDefault();
      event.stopPropagation();
      resume();
      if (event.type === "pointerdown") {
        const swallow = new AbortController();
        document.addEventListener(
          "click",
          click => {
            click.preventDefault();
            click.stopPropagation();
            swallow.abort();
          },
          { capture: true, signal: swallow.signal },
        );
        window.setTimeout(() => swallow.abort(), 1000);
      }
      if (previous.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true });
    };
    const options = {
      capture: true,
      signal: AbortSignal.any([listeners.signal, signal]),
    };
    document.addEventListener("keydown", wake, options);
    document.addEventListener("pointerdown", wake, options);
    // Leaving Portfolio 98 (power, navigation) must not leave the light amber.
    signal.addEventListener("abort", resume, { signal: listeners.signal });
  }

  return {
    get open() {
      return open;
    },
    show,
    standBy,
  };
}
