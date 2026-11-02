---
id: "tetris"
name: "Tetris"
category: "Game"
summary: "A C++ falling-block puzzle, now playable in the browser."
stack: ["C++", "OpenGL", "GLUT", "WebAssembly"]
source: "https://github.com/adam-zielonka/tetris"
demo: "https://adam-zielonka.github.io/tetris/"
order: 16
---

### The idea

Originally created in June 2015 for a university course in computer graphics and visualization, this Tetris implementation now also runs in the browser. Arrange falling blocks and clear completed rows.

### How it works

Written in C++ with OpenGL and GLUT, the game is compiled to WebAssembly with Emscripten for the browser. It includes menu, settings, help and results screens, with keyboard controls on desktop and on-screen controls on phones. High scores are saved locally in the browser. The web version supports Polish and English, with automatic language selection and a saved manual choice.
