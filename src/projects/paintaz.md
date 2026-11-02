---
id: "paintaz"
name: "paintAZ"
category: "App"
summary: "A cross-platform drawing app, now also available in the browser."
stack: ["C++", "Qt", "WebAssembly"]
source: "https://github.com/adam-zielonka/paintaz"
demo: "https://adam-zielonka.github.io/paintaz/"
releases: "https://github.com/adam-zielonka/paintaz/releases/latest"
order: 8
---

### The idea

A drawing application created to explore cross-platform desktop programming: a canvas, drawing tools and color controls built with C++ and Qt.

### How it works

Qt provides the interface and drawing APIs, with desktop packages for Linux, Windows and macOS. The same drawing code runs in the browser through WebAssembly, importing PNG, JPEG and BMP images and downloading drawings as PNG. Browser drawings stay in memory, so download them before reloading. The web version keeps the desktop Qt interface and requires WebAssembly and WebGL.
