// Convert OCR text + optional image into HTML for Readwise

export function formatHtml(ocrText, imageDataUrl) {
  const parts = [];

  // Image section
  if (imageDataUrl) {
    parts.push(`<div style="margin-bottom:1em;"><img src="${imageDataUrl}" style="max-width:100%;height:auto;" alt="Screenshot"></div>`);
  }

  // OCR text section
  if (ocrText && ocrText.trim()) {
    parts.push('<hr>');
    parts.push('<h3>Extracted Text</h3>');

    // Split into paragraphs on double newlines, single newlines become <br>
    const paragraphs = ocrText.trim().split(/\n\s*\n/);
    for (const para of paragraphs) {
      const escaped = escapeHtml(para.trim());
      const withBreaks = escaped.replace(/\n/g, '<br>');
      parts.push(`<p>${withBreaks}</p>`);
    }
  }

  if (parts.length === 0) {
    parts.push('<p><em>No content captured</em></p>');
  }

  return parts.join('\n');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
