import { describe, expect, test } from "vitest";
import { parseArgs } from "../utils/args";
import { parseLines } from "../utils/parse";
import { resolveConstants } from "../utils/constants";
import { commandFromHash, hashFromCommand } from "../utils/routes";
import { cd } from "../utils/cd";

describe("command parsing and rendering", () => {
  test("keeps quoted arguments, empty strings and whitespace intact", () => {
    expect(parseArgs(`echo "two words" 'it works' ""`)).toEqual([
      "echo",
      "two words",
      "it works",
      "",
    ]);
    expect(parseArgs("  project\tserver-status  ")).toEqual([
      "project",
      "server-status",
    ]);
  });

  test("keeps the final Markdown line and standalone constants", () => {
    expect(parseLines("first\nlast").at(-1)?.value).toBe("last");
    expect(parseLines("[](const:args)")[0].value).toBe(
      '<a href="const:args"></a>',
    );
  });

  test("runs actions at the end of a file without adding empty output", () => {
    expect(parseLines("text\n[](sleep:500)\n[](system:clear)").at(-1)).toEqual({
      value: "",
      actions: [
        { namespace: "sleep", key: "500", value: "" },
        { namespace: "system", key: "clear", value: "" },
      ],
    });
  });

  test("escapes user values without consuming adjacent links or replacement tokens", () => {
    const html =
      '<a href="const:command">name</a> <a href="https://example.com">link</a> <a href="const:args"></a> <a href="const:pwd"></a>';
    expect(
      resolveConstants(html, {
        command: "echo",
        args: ['<img src="x">', "$&"],
        pwd: "/root",
      }),
    ).toBe(
      'echo <a href="https://example.com">link</a> &lt;img src=&quot;x&quot;&gt; $&amp; /root',
    );
  });
});

describe("shareable routes", () => {
  test("round-trips supported pages and projects", () => {
    for (const command of [
      "projects",
      "about",
      "contact",
      "project server-status",
    ]) {
      expect(commandFromHash(hashFromCommand(command)!)).toBe(command);
    }
    expect(commandFromHash("#home")).toBe("whoami");
  });

  test("does not execute arbitrary fragments or extra arguments", () => {
    expect(commandFromHash("#project/<script>")).toBeUndefined();
    expect(commandFromHash("#shutdown")).toBeUndefined();
    expect(commandFromHash("#__proto__")).toBeUndefined();
    expect(hashFromCommand("project server-status extra")).toBeUndefined();
    expect(hashFromCommand("echo contact")).toBeUndefined();
  });
});

describe("directory normalization", () => {
  test.each([
    ["~", "projects/./server-status", "~/projects/server-status"],
    ["~/projects/server-status", "..", "~/projects"],
    ["~/projects", "../..", "/"],
    ["~", "/rooted", "/rooted"],
    ["/", "../../root//projects", "~/projects"],
    ["~/projects", "", "~"],
  ])("cd from %s to %s returns %s", (from, to, expected) => {
    expect(cd(from, to)).toBe(expected);
  });
});
