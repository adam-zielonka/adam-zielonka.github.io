---
id: "saper"
name: "Saper"
category: "Game"
summary: "A Pascal Minesweeper game from 2011, running in the browser."
stack: ["Pascal", "DOSBox", "js-dos"]
source: "https://github.com/adam-zielonka/saper"
demo: "https://adam-zielonka.github.io/saper/"
order: 15
---

### The idea

A high-school project from May 2011 inspired by Windows Minesweeper. Use the numbered clues to uncover safe cells and avoid the hidden mines.

### How it works

The game keeps its original DOS implementation, including its menu, help and end-of-game screens. DOS Pascal Docker builds the Pascal source, and js-dos makes the resulting executable playable without installing a DOS environment.
