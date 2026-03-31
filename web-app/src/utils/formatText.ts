export function formatText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-pink-600 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br/>');
}
