import './styles.css';
import './responsive.css';

import { mountApp } from './ui/app';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('Missing application root.');

const cleanup = mountApp(app);
window.addEventListener('beforeunload', cleanup, { once: true });

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installButton = document.querySelector<HTMLButtonElement>('[data-install-app]');
let installPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  if (installButton) installButton.hidden = false;
});

installButton?.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.disabled = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    // Browser install prompts can become invalid if the platform state changes.
  } finally {
    installButton.hidden = true;
    installButton.disabled = false;
  }
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined);
  }, { once: true });
}
