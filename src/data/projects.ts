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
  releases?: string;
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
    releases: `${github}/server-status/releases/latest`,
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
    idea: "Teaching materials created to share practical frontend development with teammates and students, based on building interfaces for factory applications.",
    decisions:
      "The tutorial focuses on React components and MobX state management. It puts these tools in the context of applications used on computers, tablets and scanners, with REST services connecting the frontend to SAP systems.",
  },
  {
    id: "unit-converter",
    art: projectArt["unit-converter"],
    name: "Unit Converter",
    category: "Tool",
    summary: "An Android unit converter with editable conversion definitions.",
    stack: ["Java", "Android", "JSON"],
    source: `${github}/unit-converter`,
    releases: `${github}/unit-converter/releases/latest`,
    idea: "A unit converter whose conversion sets can be extended instead of being fixed in the application. Create your own measures with the built-in editor or define them in a JSON file.",
    decisions:
      "Conversion definitions describe unit symbols, localized names, prefixes, factors and offsets. This keeps the conversion data separate from the Android interface. A ready-to-install APK is available in GitHub Releases.",
  },
  {
    id: "paintaz",
    art: projectArt["paintaz"],
    name: "paintAZ",
    category: "App",
    summary: "A desktop drawing app for Linux, Windows and macOS.",
    stack: ["C++", "Qt"],
    source: `${github}/paintaz`,
    releases: `${github}/paintaz/releases/latest`,
    idea: "A drawing application created to explore cross-platform desktop programming: a canvas, drawing tools and color controls built with C++ and Qt.",
    decisions:
      "Qt provides the interface and drawing APIs. The app saves drawings as images, and its release workflow packages the same code for Linux, Windows and macOS with the required Qt libraries included.",
  },
  {
    id: "dos-pascal-docker",
    art: projectArt["dos-pascal-docker"],
    name: "DOS Pascal Docker",
    category: "Tool",
    summary: "Compile old Pascal games and package them for the browser.",
    stack: ["Docker", "Shell", "DOSBox", "Turbo Pascal"],
    source: `${github}/dos-pascal-docker`,
    idea: "Keep old Pascal programs playable with a repeatable build process. This is the tool behind the browser versions of Deska and Saper, two games I first wrote in high school.",
    decisions:
      "A Docker image converts UTF-8 source to CP852 and runs Turbo Pascal inside DOSBox. It then generates a website that runs the compiled DOS executable through js-dos. Use it locally with an optional watch mode, with Docker Compose or in GitHub and GitLab CI pipelines.",
  },
  {
    id: "analytic-hierarchy-process",
    art: projectArt["analytic-hierarchy-process"],
    name: "Analytic Hierarchy Process",
    category: "App",
    summary:
      "A desktop tool for comparing alternatives across weighted criteria.",
    stack: ["C#", "Windows Forms", "AHP"],
    source: `${github}/analytic-hierarchy-process`,
    idea: "Make a decision with several competing criteria by breaking it into explicit weights and alternatives. The application explores the Analytic Hierarchy Process through an editable desktop interface.",
    decisions:
      "Define criteria, adjust their importance and enter values for each alternative. The application generates comparison matrices, calculates priorities and combines them into an overall ranking. Separate views expose the input data, matrices and results so you can follow the calculation.",
  },
  {
    id: "tiles",
    art: projectArt["tiles"],
    name: "Tiles",
    category: "Experiment",
    summary:
      "Warehouse workflow tiles with counters, progress and status colors.",
    stack: ["React", "TypeScript", "MobX"],
    source: `${github}/tiles`,
    demo: `${pages}/tiles/`,
    idea: "Explore how a compact tile interface can make warehouse work easier to scan, from planning and transfers to picking and posting.",
    decisions:
      "React renders the tiles while MobX manages their state. Counters, progress indicators and colors distinguish workflow stages; filters and highlighting help inspect them. The project is an interface demo with sample data.",
  },
  {
    id: "mobx-example",
    art: projectArt["mobx-example"],
    name: "MobX example",
    category: "Learning",
    summary: "An example of managing application state with MobX.",
    stack: ["React", "TypeScript", "MobX"],
    source: `${github}/mobx-example`,
    demo: `${pages}/mobx-example/`,
    idea: "A small, focused example of reactive application state. A counter makes it easy to see how a change travels from a user action through a store to the interface.",
    decisions:
      "An observable counter is updated by an action, while a computed value derives its double. React observer components update when the values they use change, keeping the example small enough to read alongside its unit tests.",
  },
  {
    id: "svelte-example",
    art: projectArt["svelte-example"],
    name: "Svelte example",
    category: "Learning",
    summary: "Editable counters and a shared total built with Svelte stores.",
    stack: ["Svelte", "TypeScript"],
    source: `${github}/svelte-example`,
    demo: `${pages}/svelte-example/`,
    idea: "Explore reusable components and shared reactive state with a collection of counters. Add up to four counters, edit their values and watch the total change.",
    decisions:
      "A writable store holds the counter values. Derived stores calculate the sum and whether another counter can be added, so the interface reacts to updates without manually synchronizing each component.",
  },
  {
    id: "deska",
    art: projectArt["deska"],
    name: "Deska",
    category: "Game",
    summary:
      "A Pascal brick-breaking game from 2011, preserved for the browser.",
    stack: ["Pascal", "DOSBox", "js-dos"],
    source: `${github}/deska`,
    demo: `${pages}/deska/`,
    idea: "One of my first games, written in high school in January 2011. Move the paddle, keep the ball in play and clear the bricks in a Breakout-style arcade game.",
    decisions:
      "The original program lived in one large loop before a rewrite in 2020. DOS Pascal Docker now handles character encoding and compilation with Turbo Pascal, while js-dos runs the DOS executable in a browser.",
  },
  {
    id: "saper",
    art: projectArt["saper"],
    name: "Saper",
    category: "Game",
    summary: "A Pascal Minesweeper game from 2011, running in the browser.",
    stack: ["Pascal", "DOSBox", "js-dos"],
    source: `${github}/saper`,
    demo: `${pages}/saper/`,
    idea: "A high-school project from May 2011 inspired by Windows Minesweeper. Use the numbered clues to uncover safe cells and avoid the hidden mines.",
    decisions:
      "The game keeps its original DOS implementation, including its menu, help and end-of-game screens. DOS Pascal Docker builds the Pascal source, and js-dos makes the resulting executable playable without installing a DOS environment.",
  },
  {
    id: "tetris",
    art: projectArt["tetris"],
    name: "Tetris",
    category: "Game",
    summary: "A C++ falling-block puzzle, now playable in the browser.",
    stack: ["C++", "OpenGL", "GLUT", "WebAssembly"],
    source: `${github}/tetris`,
    demo: `${pages}/tetris/`,
    idea: "Originally created in June 2015 for a university course in computer graphics and visualization, this Tetris implementation now also runs in the browser. Arrange falling blocks and clear completed rows.",
    decisions:
      "Written in C++ with OpenGL and GLUT, the game is compiled to WebAssembly with Emscripten for the browser. It includes menu, settings, help and results screens, with keyboard controls on desktop and on-screen controls on phones. High scores are saved locally in the browser.",
  },
  {
    id: "statki",
    art: projectArt["statki"],
    name: "Ships",
    category: "Game",
    summary:
      "Browser Battleship against a computer that follows up on its hits.",
    stack: ["JavaScript"],
    source: `${github}/statki`,
    demo: `${pages}/statki/`,
    idea: "A browser version of Battleship: find the opposing fleet on a coordinate grid before the computer sinks yours.",
    decisions:
      "The board and turn logic live separately from the interface. The computer starts with random shots, then explores neighboring cells after a hit and follows the ship's direction once more of it is revealed. Hits keep the turn going; a miss passes it to the opponent.",
  },
  {
    id: "pan",
    art: projectArt["pan"],
    name: "Pan",
    category: "Game",
    summary:
      "The Polish card game with tactical, Monte Carlo and tree-search bots.",
    stack: ["Svelte", "TypeScript", "Game AI"],
    source: `${github}/pan`,
    demo: `${pages}/pan/`,
    idea: "Bring the Polish card game Pan to a shared virtual table for two to four players. Play against computer opponents or watch them compete, with a responsive interface and a history of moves. Players try to empty their hands; the last player holding cards loses.",
    decisions:
      "Opponents range from random and greedy strategies to tactical evaluation, flat Monte Carlo simulation, MCTS with UCT and MaxN search. Monte Carlo bots sample unknown hands; the experimental MaxN opponent deliberately sees every hand. Simulations run separately from the live game with bounded search, and repeated-state memory helps some bots reduce loops. These are experiments with different decision strategies, with no verified ranking of playing strength.",
  },
  {
    id: "chinczyk",
    art: projectArt["chinczyk"],
    name: "Chińczyk",
    category: "Game",
    summary:
      "Ludo for friends and computer opponents with different playing styles.",
    stack: ["React", "TypeScript", "Game AI"],
    source: `${github}/chinczyk`,
    demo: `${pages}/chinczyk/`,
    idea: "A browser version of Chińczyk, also known as Ludo, for two to four players sharing one screen. Choose people or computer opponents for each color, race your pieces home or watch an all-bot match.",
    decisions:
      "The interface highlights legal moves after each die roll and lets you pause play or adjust the opponents' speed. Bots use different strategies: releasing pieces, racing one pawn, avoiding danger, seeking captures or exploring possible continuations. On phones, the die and controls stay at the bottom of the screen for easy access.",
  },
];

export const findProject = (id: string) =>
  projects.find(project => project.id === id);
