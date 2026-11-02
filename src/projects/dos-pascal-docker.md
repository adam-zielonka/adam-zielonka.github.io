---
id: "dos-pascal-docker"
name: "DOS Pascal Docker"
category: "Tool"
summary: "Compile old Pascal games and package them for the browser."
stack: ["Docker", "Shell", "DOSBox", "Turbo Pascal"]
source: "https://github.com/adam-zielonka/dos-pascal-docker"
order: 9
---

### The idea

Keep old Pascal programs playable with a repeatable build process. This is the tool behind the browser versions of Deska and Saper, two games I first wrote in high school.

### How it works

A Docker image converts UTF-8 source to CP852 and runs Turbo Pascal inside DOSBox. It then generates a website that runs the compiled DOS executable through js-dos. Use it locally with an optional watch mode, with Docker Compose or in GitHub and GitLab CI pipelines.
