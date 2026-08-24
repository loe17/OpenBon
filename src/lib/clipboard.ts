/**
 * Universeller Clipboard-Helper für HTTP und HTTPS Umgebungen.
 * Funktioniert zuverlässig auch in ungesicherten Kontexten (z. B. http://openbon.local oder LAN-IPs).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Moderne Clipboard API versuchen (Standard in HTTPS / localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Bei DOMException: NotAllowedError oder ungesichertem Kontext -> Fallback ausführen
    }
  }

  // 2. Robuster DOM-Fallback (execCommand 'copy') für HTTP / mobile Browser
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    } catch (err) {
      console.warn('Fallback copy failed:', err);
    }
  }

  return false;
}
