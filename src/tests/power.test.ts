import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest";
import type { Store } from "../store/store";
import { startupCommands } from "../utils/boot";

let store: Store;
const screen = () => document.querySelector<HTMLElement>(".CRTScreen")!;
const button = () =>
  document.querySelector<HTMLButtonElement>("[data-toggle-power]")!;
const indicators = () => document.querySelector<HTMLElement>(".CRTIndicators")!;

beforeAll(async () => {
  // Use the real case markup so an aria-hidden ancestor cannot hide the control.
  const body = readFileSync("index.html", "utf8").match(
    /<body>([\s\S]*)<\/body>/,
  )![1];
  document.body.innerHTML = body.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/g,
    "",
  );
  localStorage.setItem("portfolio-animations", "false");
  await import("../main");
  store = window.store;
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
});

beforeEach(() => {
  window.history.replaceState(null, "");
  window.terminal.powerOff();
  screen().inert = false;
  screen().removeAttribute("aria-hidden");
  delete screen().dataset.power;
  button().setAttribute("aria-pressed", "true");
  button().title = "Turn off computer";
  store.system.animations = false;
  store.system.state = "";
  window.terminal.clear();
});

afterEach(async () => {
  if (!store.system.isPoweredOff) store.system.togglePower();
  if (vi.isFakeTimers()) await vi.runAllTimersAsync();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => document.body.replaceChildren());

function expectPoweredOff() {
  expect(store.system.isPoweredOff).toBe(true);
  expect(store.system.isInputAllowed).toBe(false);
  expect(screen().dataset.power).toBe("off");
  expect(screen().inert).toBe(true);
  expect(screen().getAttribute("aria-hidden")).toBe("true");
  expect(button().getAttribute("aria-pressed")).toBe("false");
  expect(button().closest('[inert], [aria-hidden="true"]')).toBeNull();
  expect(button().hidden).toBe(false);
  expect(button().closest("[hidden]")).toBeNull();
  expect(indicators().dataset.disk).toBe("off");
  expect(document.activeElement).toBe(button());
  expect(document.querySelector(".Experience")).toBeNull();
  expect(document.querySelector('input[name="command"]')).toBeNull();
  expect(document.getElementById("command-status")?.textContent).toContain(
    "Computer powered off",
  );
}

test("the case button powers off, blocks commands and powers on with a fresh page", async () => {
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  expect(button().closest('[aria-hidden="true"]')).toBeNull();
  expect(indicators().querySelector(".CRTLED--power")).not.toBeNull();
  expect(indicators().querySelector(".CRTLED--disk")).not.toBeNull();
  expect(button().querySelector(".CRTLED")).toBeNull();
  button().click();
  expectPoweredOff();
  expect(reload).not.toHaveBeenCalled();
  await store.system.addCommand("ping");
  expect(document.querySelector(".TerminalOutput")?.textContent).not.toContain(
    "pong",
  );
  button().click();
  expect(reload).toHaveBeenCalledTimes(1);
  expect(startupCommands("#project/tetris")).toEqual([
    "boot",
    "project tetris",
  ]);
  expect(startupCommands("#project/tetris")).toEqual(["project tetris"]);
});

test.each([
  ["projects", 240],
  ["neo", 600],
  ["shutdown", 130],
] as const)(
  "powering off during %s stops it without late revival",
  async (command, elapsed) => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand(command, {
      animateCommand: false,
      route: false,
    });
    await vi.advanceTimersByTimeAsync(elapsed);
    expect(store.system.isProcessing).toBe(true);
    expect(indicators().dataset.disk).toBe("busy");
    button().click();
    await task;
    await vi.runAllTimersAsync();
    expectPoweredOff();
  },
);

test("powering off dismisses a reduced-motion Matrix waiting for input", async () => {
  const task = store.system.addCommand("neo", { animateCommand: false });
  await vi.waitFor(() =>
    expect(document.querySelector(".MatrixOutput")?.textContent).toContain(
      "Knock, knock",
    ),
  );
  button().click();
  await task;
  expectPoweredOff();
});

test("shutdown has no restart action and Escape leaves power control to the case", async () => {
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  await store.system.addCommand("shutdown", { animateCommand: false });
  const dialog = document.querySelector<HTMLDialogElement>(
    ".Experience--shutdown",
  )!;
  expect(dialog.querySelector("button")).toBeNull();
  const escape = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  dialog.dispatchEvent(escape);
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(escape.defaultPrevented).toBe(true);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(store.system.shutdown).toBe(true);
  expect(indicators().dataset.disk).toBe("off");
  expect(reload).not.toHaveBeenCalled();
  button().click();
  expectPoweredOff();
  button().click();
  expect(reload).toHaveBeenCalledTimes(1);
});

test("the power button also recovers a frozen terminal", async () => {
  await store.system.addCommand("panic", { animateCommand: false });
  expect(store.system.state).toBe("freeze");
  expect(indicators().dataset.disk).toBe("off");
  button().click();
  expectPoweredOff();
});

test("disk activity follows command execution and returns to idle after completion", async () => {
  expect(indicators().dataset.disk).toBe("idle");
  vi.useFakeTimers();
  store.system.animations = true;
  const task = store.system.addCommand("projects", {
    animateCommand: false,
    route: false,
  });
  await vi.advanceTimersByTimeAsync(240);
  expect(indicators().dataset.disk).toBe("busy");
  store.system.skipAnimation();
  await task;
  expect(indicators().dataset.disk).toBe("idle");
  expect(button().getAttribute("aria-pressed")).toBe("true");
});

test("interrupting a command restores idle disk activity", async () => {
  const task = store.system.addCommand("neo", { animateCommand: false });
  await vi.waitFor(() =>
    expect(document.querySelector(".MatrixOutput")?.textContent).toContain(
      "Knock, knock",
    ),
  );
  expect(indicators().dataset.disk).toBe("busy");
  await store.system.break();
  await task;
  expect(indicators().dataset.disk).toBe("idle");
});

test("reduced-motion power-on prints the boot log and then opens the portfolio", async () => {
  const enterBoot = vi.spyOn(window.terminal, "enterBoot");
  vi.spyOn(window.location, "reload").mockImplementation(() => {});
  button().click();
  button().click();
  const commands = startupCommands("");
  // Simulate the new page after the requested reload, keeping real startup code.
  screen().inert = false;
  screen().removeAttribute("aria-hidden");
  delete screen().dataset.power;
  button().setAttribute("aria-pressed", "true");
  store.system.state = "";
  await store.system.start(commands);
  expect(enterBoot).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".Experience--boot")).toBeNull();
  expect(document.querySelector(".TerminalOutput .BootBanner")).toBeNull();
  expect(document.querySelector(".HomeOutput")).not.toBeNull();
  expect(store.history.lastCommand).toBe("whoami");
  expect(indicators().dataset.disk).toBe("idle");
});

test("boot fills only the CRT, scrolls its own log and Escape skips every remaining entry", async () => {
  expect(store.commands.getLines("boot")[0].value).toContain("BootBanner");
  vi.useFakeTimers();
  store.system.animations = true;
  const previousCommand = store.history.lastCommand;
  const startup = store.system.start(["boot", "whoami"]);
  expect(
    document.querySelector<HTMLDialogElement>(".Experience--boot")?.open,
  ).toBe(true);
  expect(document.querySelector(".CommandLine")).toBeNull();
  expect(store.history.lastCommand).toBe(previousCommand);
  await vi.advanceTimersByTimeAsync(350);
  const dialog =
    document.querySelector<HTMLDialogElement>(".Experience--boot")!;
  expect(dialog.open).toBe(true);
  expect(dialog.parentElement).toBe(screen());
  expect(dialog.querySelector("button")).toBeNull();
  expect(document.activeElement).toBe(dialog);
  expect(document.getElementById("root")!.inert).toBe(true);
  expect(document.querySelector<HTMLElement>(".QuickCommands")!.inert).toBe(
    true,
  );
  expect(button().closest("[inert]")).toBeNull();
  expect(document.querySelector(".TerminalOutput .BootBanner")).toBeNull();
  vi.spyOn(dialog, "scrollHeight", "get").mockReturnValue(950);
  const background = document.querySelector<HTMLElement>(".TerminalOutput")!;
  background.scrollTop = 123;
  expect(document.querySelector<HTMLElement>(".BootBanner")?.hidden).toBe(
    false,
  );
  expect(document.querySelector(".BootLine")).toBeNull();
  expect(indicators().dataset.disk).toBe("busy");
  await vi.advanceTimersByTimeAsync(1000);
  expect(dialog.scrollTop).toBe(950);
  expect(background.scrollTop).toBe(123);
  expect(document.querySelector(".BootLine:not([hidden])")).not.toBeNull();
  expect(document.querySelector(".HomeOutput")).toBeNull();
  const escape = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  dialog.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true);
  await vi.runAllTimersAsync();
  await startup;
  const services = store.commands
    .getLines("boot")
    .filter(line => line.value.includes('class="BootLine"'));
  expect(dialog.querySelectorAll(".BootLine:not([hidden])")).toHaveLength(
    services.length,
  );
  expect(dialog.isConnected).toBe(false);
  expect(document.getElementById("root")!.inert).toBe(false);
  expect(document.querySelector<HTMLElement>(".QuickCommands")!.inert).toBe(
    false,
  );
  expect(document.querySelector(".HomeOutput")).not.toBeNull();
  expect(store.system.isInputAllowed).toBe(true);
});

test("manually entering boot still prints the command and records it in history", async () => {
  vi.useFakeTimers();
  store.system.animations = true;
  const task = store.system.addCommand("boot", { animateCommand: false });
  expect(document.querySelector(".CommandLine")?.textContent).toMatch(/boot$/);
  expect(store.history.lastCommand).toBe("boot");
  await vi.advanceTimersByTimeAsync(0);
  expect(
    document.querySelector<HTMLDialogElement>(".Experience--boot")?.open,
  ).toBe(true);
  await store.system.break();
  await task;
});

test("Ctrl+C cancels startup without opening the queued home page", async () => {
  vi.useFakeTimers();
  store.system.animations = true;
  const startup = store.system.start(["boot", "whoami"]);
  await vi.advanceTimersByTimeAsync(350);
  const dialog = document.querySelector(".Experience--boot")!;
  const interrupt = new KeyboardEvent("keydown", {
    key: "c",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  dialog.dispatchEvent(interrupt);
  expect(interrupt.defaultPrevented).toBe(true);
  await startup;
  await vi.runAllTimersAsync();
  expect(document.querySelector(".HomeOutput")).toBeNull();
  expect(document.querySelector(".Experience--boot")).toBeNull();
  expect(document.getElementById("root")!.inert).toBe(false);
  expect(store.system.isInputAllowed).toBe(true);
  expect(indicators().dataset.disk).toBe("idle");
});

test("power-off during boot prevents the queued portfolio from reviving the computer", async () => {
  vi.useFakeTimers();
  store.system.animations = true;
  const startup = store.system.start(["boot", "whoami"]);
  await vi.advanceTimersByTimeAsync(700);
  button().click();
  await startup;
  await vi.runAllTimersAsync();
  expectPoweredOff();
  expect(document.querySelector(".HomeOutput")).toBeNull();
});

test("navigation during boot opens the new route instead of the queued home page", async () => {
  vi.useFakeTimers();
  store.system.animations = true;
  const startup = store.system.start(["boot", "whoami"]);
  await vi.advanceTimersByTimeAsync(350);
  window.location.hash = "#contact";
  await vi.runAllTimersAsync();
  await startup;
  expect(document.querySelector(".HomeOutput")).toBeNull();
  expect(document.querySelector(".TextOutput h2")?.textContent).toBe(
    "Find me on GitHub.",
  );
  expect(store.history.lastCommand).toBe("contact");
  expect(store.system.isInputAllowed).toBe(true);
});

test("Windows shutdown dims the actual desktop, shows the splash and ends on the safe screen", async () => {
  vi.useFakeTimers();
  await store.system.addCommand("windows", {
    route: false,
    animateCommand: false,
  });
  const desktop = document.querySelector<HTMLElement>(".Win98")!;
  const output = document.querySelector(".TerminalOutput")!;
  const previousOutput = output.innerHTML;
  store.system.animations = true;
  const task = store.system.addCommand("shutdown", {
    route: false,
    animateCommand: false,
  });
  const transition = document.querySelector<HTMLDialogElement>(
    ".Experience--shutdown-animation",
  )!;
  expect(transition.open).toBe(true);
  expect(transition.dataset.phase).toBe("desktop");
  expect(desktop.isConnected).toBe(true);
  expect(desktop.inert).toBe(true);
  expect(output.innerHTML).toBe(previousOutput);
  expect(document.activeElement).toBe(transition);
  expect(indicators().dataset.disk).toBe("busy");
  await vi.advanceTimersByTimeAsync(650);
  expect(transition.dataset.phase).toBe("splash");
  expect(document.querySelector(".Experience--shutdown")).toBeNull();
  await vi.advanceTimersByTimeAsync(2300);
  await task;
  expect(transition.isConnected).toBe(false);
  expect(desktop.isConnected).toBe(false);
  expect(store.system.shutdown).toBe(true);
  expect(document.querySelector(".Shutdown")!.textContent).toContain(
    "It's now safe",
  );
  expect(indicators().dataset.disk).toBe("off");
});

test.each([200, 1000])(
  "power-off at %sms during Windows shutdown cannot revive the screen",
  async elapsed => {
    vi.useFakeTimers();
    await store.system.addCommand("windows", {
      route: false,
      animateCommand: false,
    });
    store.system.animations = true;
    const task = store.system.addCommand("shutdown", {
      route: false,
      animateCommand: false,
    });
    await vi.advanceTimersByTimeAsync(elapsed);
    button().click();
    await task;
    await vi.runAllTimersAsync();
    expectPoweredOff();
    expect(document.querySelector(".Win98")).toBeNull();
    // Both overlay snapshots must unwind in reverse order.
    expect(document.getElementById("root")!.inert).toBe(false);
  },
);

test.each(["Escape", "Ctrl+C"])(
  "%s skips shutdown animation without returning to the desktop",
  async key => {
    vi.useFakeTimers();
    await store.system.addCommand("windows", {
      route: false,
      animateCommand: false,
    });
    store.system.animations = true;
    const task = store.system.addCommand("shutdown", {
      route: false,
      animateCommand: false,
    });
    await vi.advanceTimersByTimeAsync(100);
    const dialog = document.querySelector(".Experience--shutdown-animation")!;
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: key === "Ctrl+C" ? "c" : key,
        ctrlKey: key === "Ctrl+C",
        bubbles: true,
        cancelable: true,
      }),
    );
    await task;
    expect(store.system.shutdown).toBe(true);
    expect(document.querySelector(".Win98")).toBeNull();
    expect(
      document.querySelector(".Experience--shutdown-animation"),
    ).toBeNull();
    expect(document.querySelector(".Shutdown")).not.toBeNull();
  },
);

test("disabled animations bypass both shutdown stages and leave no timers", async () => {
  vi.useFakeTimers();
  await store.system.addCommand("windows", {
    route: false,
    animateCommand: false,
  });
  await store.system.addCommand("shutdown", {
    route: false,
    animateCommand: false,
  });
  expect(store.system.shutdown).toBe(true);
  expect(document.querySelector(".Experience--shutdown-animation")).toBeNull();
  expect(document.querySelector(".Win98")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

test("navigation during shutdown cancels its remaining stages and restores terminal controls", async () => {
  vi.useFakeTimers();
  await store.system.addCommand("windows", {
    route: false,
    animateCommand: false,
  });
  store.system.animations = true;
  const task = store.system.addCommand("shutdown", {
    route: false,
    animateCommand: false,
  });
  await vi.advanceTimersByTimeAsync(800);
  window.location.hash = "#project/paintaz";
  // Deliver navigation now: Happy DOM's native hash timer is not advanced
  // alongside the command's fake timers and otherwise arrives after shutdown.
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await vi.runAllTimersAsync();
  await task;
  expect(store.system.isInputAllowed).toBe(true);
  expect(document.querySelector(".Experience")).toBeNull();
  expect(document.querySelector(".Win98")).toBeNull();
  expect(document.getElementById("root")!.inert).toBe(false);
  expect(document.querySelector(".ProjectDetail h2")!.textContent).toBe(
    "paintAZ",
  );
});

test.each([false, true])(
  "power-on in Windows opens its splash immediately (shutdown first: %s)",
  async shutdownFirst => {
    vi.useFakeTimers();
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => {});
    const linuxBoot = vi.spyOn(window.terminal, "enterBoot");
    await store.system.addCommand("windows", {
      route: false,
      animateCommand: false,
    });
    if (shutdownFirst)
      await store.system.addCommand("shutdown", {
        route: false,
        animateCommand: false,
      });
    button().click();
    expectPoweredOff();
    button().click();
    expect(reload).toHaveBeenCalledOnce();
    const commands = startupCommands("#windows");
    expect(commands).toEqual(["windows"]);
    // Emulate the reloaded shell while retaining the real startup dispatcher.
    screen().inert = false;
    screen().removeAttribute("aria-hidden");
    delete screen().dataset.power;
    button().setAttribute("aria-pressed", "true");
    store.system.state = "";
    window.terminal.clear();
    store.system.animations = true;
    const startup = store.system.start(commands);
    expect(
      document.querySelector<HTMLDialogElement>(".Experience--windows-startup")
        ?.open,
    ).toBe(true);
    expect(document.querySelector(".CommandLine")).toBeNull();
    expect(document.querySelector(".Experience--boot")).toBeNull();
    await vi.advanceTimersByTimeAsync(2400);
    await startup;
    expect(linuxBoot).not.toHaveBeenCalled();
    expect(document.querySelector(".Win98")).not.toBeNull();
    expect(document.querySelector(".Experience--windows-startup")).toBeNull();
    expect(store.system.isInputAllowed).toBe(true);
  },
);
