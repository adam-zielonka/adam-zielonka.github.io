import { describe, expect, test } from "vitest";
import { completeFiles, listDirectory } from "../utils/filesystem";

describe("portfolio files", () => {
  test("lists the home files and the root directory", () => {
    expect(listDirectory("/")).toEqual([{ name: "root", directory: true }]);
    expect(listDirectory("~")).toEqual([
      { name: "projects", directory: true },
      { name: "README.md", directory: false },
      { name: "about.md", directory: false },
      { name: "contact.md", directory: false },
    ]);
    expect(listDirectory("~/projects/questions")).toEqual([
      { name: "README.md", directory: false },
    ]);
  });

  test("completes files relative to the working directory", () => {
    expect(completeFiles("~", "projects/ser")).toEqual([
      "projects/server-status/README.md",
    ]);
    expect(completeFiles("~/projects/questions", "R")).toEqual(["README.md"]);
    expect(completeFiles("~/projects/questions", "../server-status/R")).toEqual(
      ["../server-status/README.md"],
    );
  });

  test("completes home and absolute paths from a project directory", () => {
    expect(completeFiles("~/projects/questions", "~/cont")).toEqual([
      "~/contact.md",
    ]);
    expect(completeFiles("~/projects/questions", "/root/ab")).toEqual([
      "/root/about.md",
    ]);
  });

  test("does not offer paths outside the portfolio", () => {
    expect(completeFiles("~", "/etc/")).toEqual([]);
    expect(completeFiles("~", "missing/")).toEqual([]);
    expect(completeFiles("~", "about.md/")).toEqual([]);
  });
});
