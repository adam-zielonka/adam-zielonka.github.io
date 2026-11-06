import { describe, expect, test } from "vitest";
import { fitHomeProjects } from "../utils/home-layout";

function layout() {
  const viewport = document.createElement("div");
  viewport.style.padding = "10px";
  viewport.innerHTML = `<ul><li class="CommandLine" style="margin: 5px 0"></li><li class="Line"><section class="HomeOutput"><h2>Projects <span class="Count">04</span></h2><div class="ProjectList">${[80, 120, 70, 90].map((height, index) => `<article class="ProjectRow" data-height="${height}" data-id="${index}"></article>`).join("")}</div><div class="OutputActions">All projects</div></section></li></ul>`;
  document.body.replaceChildren(viewport);
  const home = viewport.querySelector<HTMLElement>(".HomeOutput")!;
  const command = viewport.querySelector<HTMLElement>(".CommandLine")!;
  const rows = [...home.querySelectorAll<HTMLElement>(".ProjectRow")];
  let capacity = 400;
  command.getBoundingClientRect = () => new DOMRect(0, 0, 400, 30);
  for (const row of rows)
    row.getBoundingClientRect = () =>
      new DOMRect(0, 0, 400, row.hidden ? 0 : Number(row.dataset.height));
  home.getBoundingClientRect = () =>
    new DOMRect(
      0,
      0,
      400,
      100 +
        rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0),
    );
  Object.defineProperty(viewport, "clientHeight", {
    get: () => Math.min(capacity, home.getBoundingClientRect().height + 60),
  });
  return {
    home,
    viewport,
    rows,
    resize(height: number) {
      capacity = height;
      fitHomeProjects(home, viewport);
    },
    visible: () => rows.filter(row => !row.hidden).map(row => row.dataset.id),
  };
}

describe("home project capacity", () => {
  test("reserves intro, actions, command and padding and fits complete variable-height rows", () => {
    const page = layout();
    page.resize(400);
    expect(page.visible()).toEqual(["0", "1"]);
    expect(page.home.querySelector(".Count")?.textContent).toBe("02");
    expect(page.home.querySelector<HTMLElement>(".OutputActions")!.hidden).toBe(
      false,
    );
  });

  test("grows beyond three projects and shrinks without shuffling or auto-height feedback", () => {
    const page = layout();
    page.resize(400);
    page.resize(400);
    expect(page.visible()).toEqual(["0", "1"]);
    page.resize(600);
    expect(page.visible()).toEqual(["0", "1", "2", "3"]);
    page.resize(350);
    expect(page.visible()).toEqual(["0"]);
  });

  test("retains one entry on a short screen and never resurrects interrupted output", () => {
    const page = layout();
    page.resize(100);
    expect(page.visible()).toEqual(["0"]);
    page.home.setAttribute("data-interrupted", "");
    page.resize(600);
    expect(page.visible()).toEqual(["0"]);
  });
});
