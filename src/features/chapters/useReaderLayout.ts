import { CSSProperties, PointerEvent, useEffect, useState } from "react";

const minimumCardPanelWidth = 260;
const maximumStoredCardPanelWidth = 620;

function readCardPanelWidth() {
  const stored = Number(localStorage.getItem("reading-agent-card-panel-width"));
  return Number.isFinite(stored)
    ? Math.min(maximumStoredCardPanelWidth, Math.max(minimumCardPanelWidth, stored))
    : 340;
}

export function useReaderLayout() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [cardsCollapsed, setCardsCollapsed] = useState(false);
  const [cardPanelWidth, setCardPanelWidth] = useState(readCardPanelWidth);

  useEffect(() => {
    localStorage.setItem("reading-agent-card-panel-width", String(cardPanelWidth));
  }, [cardPanelWidth]);

  const toggleNavigation = () => setNavCollapsed((current) => !current);
  const toggleArticleList = () => setListCollapsed((current) => !current);
  const toggleCardPanel = () => setCardsCollapsed((current) => !current);
  const showCardPanel = () => setCardsCollapsed(false);

  const startCardPanelResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = cardPanelWidth;
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const maximum = Math.max(320, Math.floor(window.innerWidth * 0.45));
      setCardPanelWidth(
        Math.min(maximum, Math.max(minimumCardPanelWidth, startWidth + startX - moveEvent.clientX)),
      );
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd, { once: true });
  };

  const workspaceStyle = {
    "--card-panel-width": `${cardPanelWidth}px`,
  } as CSSProperties;

  return {
    cardsCollapsed,
    listCollapsed,
    navCollapsed,
    showCardPanel,
    startCardPanelResize,
    toggleArticleList,
    toggleCardPanel,
    toggleNavigation,
    workspaceStyle,
  };
}
