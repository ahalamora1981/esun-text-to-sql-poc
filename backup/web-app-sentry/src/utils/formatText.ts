export function formatText(text: string): string {
  if (!text) return '';
  return text
    // Bold text: **text** -> <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 600;">$1</strong>')
    // Inline code: `code` -> <code>
    .replace(/`(.*?)`/g, '<code style="background-color: rgba(106, 95, 193, 0.2); color: #dcdcaa; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.875em;">$1</code>')
    // Code blocks: ```lang\ncode\n``` -> <pre><code>
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre style="background-color: #150f23; border: 1px solid #362d59; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-x: auto;"><code style="font-family: var(--font-mono); font-size: 0.875rem; line-height: 1.5; color: #dcdcaa; white-space: pre;">${escapeHtml(code.trim())}</code></pre>`;
    })
    // Line breaks
    .replace(/\n/g, '<br/>');
}

// Helper function to escape HTML in code blocks
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
