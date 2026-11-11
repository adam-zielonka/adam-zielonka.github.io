import { afterEach, beforeEach, expect, test } from "vitest";
import { requestPowerOnBoot, startupCommands } from "../utils/boot";

beforeEach(() => window.history.replaceState(null, ""));
afterEach(() => window.history.replaceState(null, ""));

test("ordinary visits and refreshes skip boot and preserve the requested page", () => {
  expect(startupCommands("")).toEqual(["whoami"]);
  expect(startupCommands("#project/tetris")).toEqual(["project tetris"]);
  expect(startupCommands("#project/tetris")).toEqual(["project tetris"]);
});

test("power-on adds boot once without changing the URL or unrelated history state", () => {
  window.history.replaceState({ scrollPosition: 123 }, "");
  const url = window.location.href;
  const length = window.history.length;
  requestPowerOnBoot();
  expect(startupCommands("#contact")).toEqual(["boot", "contact"]);
  expect(window.history.state).toEqual({ scrollPosition: 123 });
  expect(window.location.href).toBe(url);
  expect(window.history.length).toBe(length);
  expect(startupCommands("#contact")).toEqual(["contact"]);
});

test("each new power cycle requests one new boot", () => {
  for (let cycle = 0; cycle < 2; cycle++) {
    requestPowerOnBoot();
    expect(startupCommands("")).toEqual(["boot", "whoami"]);
    expect(window.history.state).toBeNull();
    expect(startupCommands("")).toEqual(["whoami"]);
  }
});

test("power-on in Windows starts its own splash without a Linux boot", () => {
  window.history.replaceState({ scrollPosition: 123 }, "", "#windows");
  const url = window.location.href;
  requestPowerOnBoot();
  expect(startupCommands("#windows")).toEqual(["windows"]);
  expect(window.history.state).toEqual({ scrollPosition: 123 });
  expect(window.location.href).toBe(url);
  expect(startupCommands("#windows")).toEqual(["windows"]);
  requestPowerOnBoot();
  expect(startupCommands("#home")).toEqual(["boot", "whoami"]);
});
