// "Print / save as PDF" without inline script, so the page works under a strict Content-Security-Policy.
document.querySelectorAll('[data-action="print"]').forEach(button => button.addEventListener('click', () => window.print()));
