# [adamzielonka.pro](https://adamzielonka.pro)

[![pipeline status](https://gitlab.com/adam-zielonka-pro/adamzielonka.pro/badges/master/pipeline.svg)](https://gitlab.com/adam-zielonka-pro/adamzielonka.pro/pipelines/latest)
[![coverage report](https://gitlab.com/adam-zielonka-pro/adamzielonka.pro/badges/master/coverage.svg)](https://gitlab.com/adam-zielonka-pro/adamzielonka.pro/pipelines/latest)

## How to use

1. Go to website [adamzielonka.pro](https://adamzielonka.pro)
2. Wait for start scripts ends.
3. Type something.
4. Press Enter key.
5. Enjoy ;-)

## Command file

This app interpreted a markdown file with attributes section written in yaml. You can see my files in repo: [./src/commands/](./src/commands/).

### Attributes

In optional yaml section, you can set:

- `command` - name, that will be use to execute command by user
- `alias` - table of aliases, that can by used also to execute command by user
- `help` - text, that will be shown in help command

### Body

All line in markdown section will be printed line by line, with links interpretations.

You can also use special links, that will be affected to the app:

- `sleep:` - wait before print next line
- `system:` - system instruction, applies to next line
  - `:clear` - clear standard output
  - `:shutdown` - shutdown the machine
  - `:freeze` - freeze the machine
  - `:echo` - print args
  - `:help` - print available instruction
- `constans:` - this links will be replaced with:
  - `:command` - name of command

## Licence

MIT
