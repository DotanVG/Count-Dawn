import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { installDeferredStart } from './landing';

if (location.hostname === 'count-dawn.vercel.app') {
  const beforeSend = <T extends { url: string }>(event: T): T => ({
    ...event, url: location.origin + location.pathname,
  });
  inject({ beforeSend });
  injectSpeedInsights({ beforeSend });
}

installDeferredStart(async (context, progress) => {
  const { bootGame } = await import('./main');
  return bootGame(context, progress);
});

// The itch wrapper's timeout ends when the landing is interactive, before entry.
if (window.parent !== window) window.parent.postMessage('count-dawn:ready', '*');
