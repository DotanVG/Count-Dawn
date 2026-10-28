type FullscreenDocument = {
  readonly fullscreenElement?: Element | null;
  readonly webkitFullscreenElement?: Element | null;
  readonly fullscreenEnabled?: boolean;
  readonly webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  addEventListener: Document['addEventListener'];
};

type FullscreenTarget = {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/** Browser state is authoritative, including exits initiated outside the button. */
export function createFullscreenController(
  doc: FullscreenDocument,
  target: FullscreenTarget,
  onChange: (supported: boolean, fullscreen: boolean) => void,
): { toggle: () => Promise<void> } {
  let pending = false;
  const standard = (): boolean => Boolean(doc.fullscreenEnabled && target.requestFullscreen && doc.exitFullscreen);
  const webkit = (): boolean => Boolean(doc.webkitFullscreenEnabled && target.webkitRequestFullscreen && doc.webkitExitFullscreen);
  const sync = (): void => onChange(standard() || webkit(), Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));

  for (const event of ['fullscreenchange', 'webkitfullscreenchange', 'fullscreenerror', 'webkitfullscreenerror']) {
    doc.addEventListener(event, sync);
  }
  sync();

  return {
    async toggle(): Promise<void> {
      if (pending || !(standard() || webkit())) return;
      pending = true;
      try {
        // Select the method, not its return value: legacy WebKit may return void.
        if (doc.fullscreenElement) {
          await doc.exitFullscreen?.();
        } else if (doc.webkitFullscreenElement) {
          await doc.webkitExitFullscreen?.();
        } else if (standard()) {
          await target.requestFullscreen?.();
        } else {
          await target.webkitRequestFullscreen?.();
        }
      } catch {
        // Permission denial or a concurrent browser exit must leave the button usable.
      } finally {
        pending = false;
        sync();
      }
    },
  };
}
