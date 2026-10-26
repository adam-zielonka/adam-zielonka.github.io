import { projectArt } from "./project-art.ts";
import type { ProjectArt } from "./project-art.ts";

export type Project = {
  id: string;
  name: string;
  category: "Tool" | "App" | "Game" | "Experiment" | "Learning";
  summary: string;
  art: ProjectArt;
  stack: string[];
  source: string;
  demo?: string;
  featured?: boolean;
  idea?: string;
  decisions?: string;
};

const github = "https://github.com/adam-zielonka";
const pages = "https://adam-zielonka.github.io";

export const projects: Project[] = [
  {
    id: "server-status",
    art: projectArt["server-status"],
    name: "Server Status",
    category: "Tool",
    summary: "Server health, metrics and history in one dashboard.",
    stack: ["Go", "React", "TypeScript"],
    source: `${github}/server-status`,
    demo: `${pages}/server-status/`,
    featured: true,
    idea: "One place to check server health, from resource usage to service status and historical metrics.",
    decisions:
      "The Go API and React frontend ship as a single executable. An optional collector gathers metrics on Linux. The public demo uses sample data, so you can explore the interface without connecting to a server.",
  },
  {
    id: "questions",
    art: projectArt["questions"],
    name: "Questions",
    category: "App",
    summary: "Custom question sets, exam practice and saved progress.",
    stack: ["React", "MobX", "PWA"],
    source: `${github}/questions`,
    demo: `${pages}/questions/`,
    featured: true,
    idea: "Built to practice questions before an exam. You can create your own question sets and import them from a JSON file.",
    decisions:
      "Questions and progress stay in local browser storage. PWA support lets you install the app on your phone. React handles the interface, while MobX manages the learning state.",
  },
  {
    id: "game-of-life",
    art: projectArt["game-of-life"],
    name: "Game of Life",
    category: "Experiment",
    summary: "Simple rules. Complex behavior. Conway's cellular automaton.",
    stack: ["JavaScript", "Cellular automaton"],
    source: `${github}/game-of-life`,
    demo: `${pages}/game-of-life/`,
    featured: true,
    idea: "An implementation of Conway's Game of Life: each generation of cells is determined by the state of their eight neighbors.",
    decisions:
      "The code separates the simulation engine from the board and settings. A small experiment in how complex patterns emerge from just a few rules.",
  },
  {
    id: "portfolio",
    art: projectArt["portfolio"],
    name: "This portfolio",
    category: "Experiment",
    summary: "The interactive terminal you are exploring right now.",
    stack: ["TypeScript", "Vite", "SCSS"],
    source: `${github}/adam-zielonka.github.io`,
    idea: "A personal space on the web and a playground for experimenting with a terminal interface.",
    decisions:
      "The interface uses native DOM APIs, with commands defined in Markdown. Since its first version in 2017, the site has moved through React and Svelte before returning to plain TypeScript.",
  },
  {
    id: "frontend-tutorial",
    art: projectArt["frontend-tutorial"],
    name: "Frontend tutorial",
    category: "Learning",
    summary: "Learning materials on building apps with React and MobX.",
    stack: ["React", "MobX"],
    source: `${github}/frontend-tutorial`,
    demo: `${pages}/frontend-tutorial/`,
  },
  {
    id: "unit-converter",
    art: projectArt["unit-converter"],
    name: "Unit Converter",
    category: "Tool",
    summary: "A unit conversion tool.",
    stack: [],
    source: `${github}/unit-converter`,
  },
  {
    id: "paintaz",
    art: projectArt["paintaz"],
    name: "paintAZ",
    category: "App",
    summary: "A drawing application.",
    stack: [],
    source: `${github}/paintaz`,
  },
  {
    id: "tiles",
    art: projectArt["tiles"],
    name: "Tiles",
    category: "Experiment",
    summary: "An experiment with a tile-based interface.",
    stack: ["React", "TypeScript", "MobX"],
    source: `${github}/tiles`,
    demo: `${pages}/tiles/`,
  },
  {
    id: "mobx-example",
    art: projectArt["mobx-example"],
    name: "MobX example",
    category: "Learning",
    summary: "An example of managing application state with MobX.",
    stack: ["MobX"],
    source: `${github}/mobx-example`,
    demo: `${pages}/mobx-example/`,
  },
  {
    id: "svelte-example",
    art: projectArt["svelte-example"],
    name: "Svelte example",
    category: "Learning",
    summary: "An experiment in building an interface with Svelte.",
    stack: ["Svelte"],
    source: `${github}/svelte-example`,
    demo: `${pages}/svelte-example/`,
  },
  {
    id: "deska",
    art: projectArt["deska"],
    name: "Deska",
    category: "Game",
    summary: "A game you can play directly in your browser.",
    stack: [],
    source: `${github}/deska`,
    demo: `${pages}/deska/`,
  },
  {
    id: "saper",
    art: projectArt["saper"],
    name: "Saper",
    category: "Game",
    summary: "Classic minesweeping in your browser.",
    stack: [],
    source: `${github}/saper`,
    demo: `${pages}/saper/`,
  },
  {
    id: "tetris",
    art: projectArt["tetris"],
    name: "Tetris",
    category: "Game",
    summary: "A take on the classic falling-block puzzle.",
    stack: [],
    source: `${github}/tetris`,
  },
  {
    id: "statki",
    art: projectArt["statki"],
    name: "Ships",
    category: "Game",
    summary: "A browser-based version of Battleship.",
    stack: [],
    source: `${github}/statki`,
    demo: `${pages}/statki/`,
  },
  {
    id: "pan",
    art: projectArt["pan"],
    name: "Pan",
    category: "Game",
    summary: "A card game project.",
    stack: [],
    source: `${github}/pan`,
    demo: `${pages}/pan/`,
  },
  {
    id: "chinczyk",
    art: projectArt["chinczyk"],
    name: "Chińczyk",
    category: "Game",
    summary: "A classic board game, playable in your browser.",
    stack: [],
    source: `${github}/chinczyk`,
    demo: `${pages}/chinczyk/`,
  },
];

export const findProject = (id: string) =>
  projects.find(project => project.id === id);
