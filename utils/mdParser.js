let markedModule;

async function parseMarkdown(mdContent) {
  if (!markedModule) {
    markedModule = await import("marked");
  }
  const { marked } = markedModule;

  // Convert markdown to HTML
  const html = marked.parse(mdContent);

  return html;
}

module.exports = { parseMarkdown };