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
