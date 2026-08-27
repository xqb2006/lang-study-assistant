export function installViewportHeightSync() {
  const update = () => {
    const visualViewport = window.visualViewport;
    const visualWidth = visualViewport?.width ?? window.innerWidth;
    const visualHeight = visualViewport?.height ?? window.innerHeight;
    const height = Number.isFinite(visualHeight) && visualHeight > 0 ? Math.round(visualHeight) : window.innerHeight;
    const width = Number.isFinite(visualWidth) && visualWidth > 0 ? Math.round(visualWidth) : window.innerWidth;
    document.documentElement.style.setProperty("--app-viewport-width", `${width}px`);
    document.documentElement.style.setProperty("--app-viewport-height", `${height}px`);
  };

  update();
  window.addEventListener("resize", update);
  window.visualViewport?.addEventListener("resize", update);

  return () => {
    window.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("resize", update);
  };
}

