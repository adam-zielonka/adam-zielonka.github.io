export type TextLine = {
  value: string
  style: Partial<CSSStyleDeclaration>
}

export type CommandLine = {
  value: string
  blink: boolean
  path: string
}

export type OutputLine = TextLine | CommandLine
