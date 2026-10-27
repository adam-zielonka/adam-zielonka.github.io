import { projects, findProject } from "../data/projects.ts";
import type { Project } from "../data/projects.ts";
import { escape } from "./escape.ts";
import { cd } from "./cd.ts";
import { directories, findFile, listDirectory } from "./filesystem.ts";

export function commandLink(
  command: string,
  label: string,
  className = "CommandLink",
): string {
  return `<button type="button" class="${className}" data-command="${escape(command)}">${escape(label)}</button>`;
}

function projectRow(project: Project, index: number): string {
  return `<article class="ProjectRow"><span class="ProjectNumber" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>${renderArt(project, "thumbnail")}<div class="ProjectInfo"><span class="ProjectCategory">${escape(project.category)}</span><h3><a href="#project/${project.id}" data-command="project ${project.id}">${escape(project.name)}<span aria-hidden="true"> ↗</span></a></h3><p>${escape(project.summary)}</p><span class="ProjectStack">${project.stack.map(escape).join(" / ")}</span></div><a class="ProjectOpen" href="#project/${project.id}" data-command="project ${project.id}" aria-label="Explore project ${escape(project.name)}"><span aria-hidden="true">↗</span></a></article>`;
}

function renderArt(project: Project, size: "thumbnail" | "detail"): string {
  return `<figure class="ProjectArt ProjectArt--${size}" role="img" aria-label="${escape(project.art.description)}"><pre aria-hidden="true">${escape(project.art.drawing)}</pre></figure>`;
}

export function renderHome(): string {
  return `<section class="HomeOutput"><header class="HomeIntro"><p class="ProjectCategory">Personal projects &amp; experiments</p><h1>Curiosity,<br /><span>written in code.</span></h1><p>Hi, I'm Adam.<br />I build web apps, tools and games. I like finding out what’s possible.</p></header><div class="OutputHeading"><h2>Selected projects<span class="Count">03</span></h2><span class="OutputNote">from idea to browser</span></div><div class="ProjectList">${projects
    .filter(project => project.featured)
    .map(projectRow)
    .join(
      "",
    )}</div><div class="OutputActions">${commandLink("projects", "All projects →")}${commandLink("help", "What can this terminal do?")}</div></section>`;
}

export function renderProjects(): string {
  return `<section><div class="OutputHeading"><h2>Project catalog<span class="Count">${projects.length}</span></h2></div><p class="OutputIntro">Tools, apps, games and experiments. Choose a project or type <code>project server-status</code>.</p><div class="ProjectList ProjectList--compact">${projects.map(projectRow).join("")}</div></section>`;
}

export function renderProject(id: string): string {
  const project = findProject(id);
  if (!project)
    return `<p class="Error">Project “${escape(id)}” not found.</p><p>${commandLink("projects", "Browse projects →")}</p>`;
  return `<article class="ProjectDetail"><div class="DetailBreadcrumb">${commandLink("projects", "projects")}<span aria-hidden="true"> / </span><span>${escape(project.id)}</span></div><div class="DetailHero"><div><span class="ProjectCategory">${escape(project.category)}</span><h2>${escape(project.name)}</h2><p class="DetailSummary">${escape(project.summary)}</p><p class="ProjectStack">${project.stack.map(escape).join(" / ")}</p></div>${renderArt(project, "detail")}</div>${project.idea ? `<h3>The idea</h3><p>${escape(project.idea)}</p>` : ""}${project.decisions ? `<h3>How it works</h3><p>${escape(project.decisions)}</p>` : ""}<div class="DetailLinks">${project.demo ? `<a class="PrimaryLink" href="${project.demo}" target="_blank" rel="noopener noreferrer">${project.category === "Game" ? "Play" : "Try the demo"} <span aria-hidden="true">↗</span></a>` : ""}${project.releases ? `<a class="${project.demo ? "" : "PrimaryLink"}" href="${project.releases}" target="_blank" rel="noopener noreferrer">Download / Releases <span aria-hidden="true">↗</span></a>` : ""}<a href="${project.source}" target="_blank" rel="noopener noreferrer">Source on GitHub <span aria-hidden="true">↗</span></a><a href="#project/${project.id}" data-copy-link="${project.id}">Copy link <span aria-hidden="true">⤴</span></a></div>${project.id === "game-of-life" ? '<p class="OutputNote">The simulation contains moving, changing patterns.</p>' : ""}</article>`;
}

export function renderAbout(): string {
  return `<section class="TextOutput"><span class="ProjectCategory">Hi, I'm Adam</span><h2>I like understanding how things work.</h2><p>I build web apps, tools and games. Some solve practical problems; others explore interfaces, application state or the simple rules behind a simulation.</p><p>I work with TypeScript, React and Go, among other tools. I also share what I learn through materials on building frontends with React and MobX.</p><h3>This site is an experiment, too</h3><p>The first version went online in 2017. After React and Svelte, this terminal now runs on native DOM APIs and TypeScript. Its commands are written in Markdown.</p><div class="OutputActions">${commandLink("project frontend-tutorial", "Explore the tutorial →")}${commandLink("project portfolio", "About this portfolio →")}${commandLink("contact", "Get in touch →")}</div></section>`;
}

export function renderContact(): string {
  return `<section class="TextOutput"><span class="ProjectCategory">Let’s talk about code</span><h2>Find me on GitHub.</h2><p>Have a question about a project, found a bug or have an idea for an improvement? Its repository is a good place to start.</p><div class="DetailLinks"><a class="PrimaryLink" href="https://github.com/adam-zielonka" target="_blank" rel="noopener noreferrer">GitHub profile <span aria-hidden="true">↗</span></a>${commandLink("projects", "Choose a repository →")}</div></section>`;
}

export function renderDirectory(path: string): string {
  const project = findProject(path.split("/").at(-1) ?? "");
  return `${project ? `<p>${escape(project.summary)}</p>` : ""}<div class="DirectoryList">${listDirectory(
    path,
  )
    .map(entry =>
      commandLink(
        `${entry.directory ? "cd" : "cat"} ${entry.name}`,
        `${entry.name}${entry.directory ? "/" : ""}`,
        "DirectoryLink",
      ),
    )
    .join("")}</div>`;
}

export function renderCat(cwd: string, args: string[]): string[] {
  if (!args.length || (args.length === 1 && args[0] === "--help"))
    return [
      '<p>Usage: <code>cat &lt;file&gt; [file ...]</code></p><p class="OutputNote">Try <code>cat about.md</code>, <code>cat ~/contact.md</code> or <code>cat projects/server-status/README.md</code>. Use <code>ls</code> to find files.</p>',
    ];
  return args.map(name => {
    const path = cd(cwd, name);
    const error = (message: string) =>
      `<p class="Error">cat: “${escape(name)}”: ${message}</p>`;
    if (name && directories.includes(path)) return error("Is a directory");
    const file = name ? findFile(path) : undefined;
    if (!file) return error("No such file or directory");
    if (name.endsWith("/")) return error("Not a directory");
    switch (file.page) {
      case "home":
        return renderHome();
      case "about":
        return renderAbout();
      case "contact":
        return renderContact();
      case "project":
        return renderProject(file.projectId);
    }
  });
}
