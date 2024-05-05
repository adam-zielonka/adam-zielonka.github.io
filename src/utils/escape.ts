export function escape(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

export function unescape(text: string) {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (char) => {
    switch (char) {
      case "&amp;": return "&";
      case "&lt;": return "<";
      case "&gt;": return ">";
      case "&quot;": return "\"";
      case "&#39;": return "'";
      default: return char;
    }
  });
}
