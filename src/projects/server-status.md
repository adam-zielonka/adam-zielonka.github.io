---
id: "server-status"
name: "Server Status"
category: "Tool"
summary: "Server health, metrics and history in one dashboard."
stack: ["Go", "React", "TypeScript"]
source: "https://github.com/adam-zielonka/server-status"
demo: "https://adam-zielonka.github.io/server-status/"
releases: "https://github.com/adam-zielonka/server-status/releases/latest"
featured: true
order: 1
---

### The idea

One place to check server health, from resource usage to service status and historical metrics.

### How it works

The Go API and React frontend ship as a single executable. An optional collector gathers metrics on Linux. The public demo uses sample data, so you can explore the interface without connecting to a server.
