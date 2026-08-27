import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ASSISTANT_EXPRESSION_EVENT,
  ASSISTANT_SETTINGS_UPDATED_EVENT,
  createCompanionSpriteUrl,
  emitCompanionExpression,
  frameStyle,
  loadAssistantSettings,
  type AssistantSettings,
  type CompanionState,
} from "./companionAppearance";

type ReaderAssistantCompanionProps = {
  onOpen: () => void;
};

const positionKey = "reading-assistant-companion-position";

function loadPosition() {
  const fallback = { x: Math.max(16, window.innerWidth - 220), y: Math.max(16, window.innerHeight - 80) };
  try {
    const saved = JSON.parse(window.localStorage.getItem(positionKey) || "{}") as { x?: number; y?: number };
    return typeof saved.x === "number" && typeof saved.y === "number"
      ? { x: Math.max(0, saved.x), y: Math.max(0, saved.y) }
      : fallback;
  } catch {
    return fallback;
  }
}

export function ReaderAssistantCompanion({ onOpen }: ReaderAssistantCompanionProps) {
  const [identity, setIdentity] = useState<AssistantSettings>(loadAssistantSettings);
  const [position, setPosition] = useState(loadPosition);
  const [expression, setExpression] = useState<CompanionState>("idle");
  const [spriteUrl, setSpriteUrl] = useState("");
  const dragState = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const expressionTimer = useRef<number | null>(null);
  const spritePath = identity.sprite?.filePath || "";
  const hasCustomSprite = Boolean(identity.sprite && spriteUrl);

  useEffect(() => {
    window.localStorage.setItem(positionKey, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    const refresh = () => setIdentity(loadAssistantSettings());
    window.addEventListener(ASSISTANT_SETTINGS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ASSISTANT_SETTINGS_UPDATED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSpriteUrl("");
    if (!identity.sprite) return undefined;
    void createCompanionSpriteUrl(identity.sprite)
      .then((url) => {
        objectUrl = url;
        if (active) setSpriteUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (active) setSpriteUrl("");
      });
    return () => {
      active = false;
      if (objectUrl && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(objectUrl);
    };
  }, [spritePath]);

  useEffect(() => {
    const updateExpression = (event: Event) => {
      const next = (event as CustomEvent<CompanionState>).detail;
      if (!next) return;
      if (expressionTimer.current) window.clearTimeout(expressionTimer.current);
      setExpression(next);
      if (next === "happy" || next === "talking") {
        expressionTimer.current = window.setTimeout(() => setExpression("idle"), 1800);
      }
    };
    window.addEventListener(ASSISTANT_EXPRESSION_EVENT, updateExpression);
    return () => {
      window.removeEventListener(ASSISTANT_EXPRESSION_EVENT, updateExpression);
      if (expressionTimer.current) window.clearTimeout(expressionTimer.current);
    };
  }, []);

  const clampPosition = (x: number, y: number) => ({
    x: Math.max(0, Math.min(x, Math.max(0, window.innerWidth - identity.size))),
    y: Math.max(0, Math.min(y, Math.max(0, window.innerHeight - identity.size))),
  });

  useEffect(() => {
    setPosition((current) => clampPosition(current.x, current.y));
  }, [identity.size]);

  const showExpression = (next: CompanionState) => {
    setExpression(next);
    emitCompanionExpression(next);
  };

  return (
    <button
      className={`reader-assistant-companion${hasCustomSprite ? " custom-sprite" : ""}`}
      type="button"
      style={{ left: position.x, top: position.y, width: hasCustomSprite ? identity.size : undefined, height: hasCustomSprite ? identity.size : undefined }}
      onPointerEnter={() => showExpression("happy")}
      onPointerLeave={() => {
        if (!dragState.current) showExpression("idle");
      }}
      onPointerDown={(event) => {
        if (event.button && event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        showExpression("drag");
        dragState.current = { offsetX: event.clientX - position.x, offsetY: event.clientY - position.y, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragState.current;
        if (!drag) return;
        const nextPosition = clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
        if (Math.abs(nextPosition.x - position.x) > 3 || Math.abs(nextPosition.y - position.y) > 3) drag.moved = true;
        setPosition(nextPosition);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        showExpression("idle");
      }}
      onPointerCancel={() => {
        dragState.current = null;
        showExpression("idle");
      }}
      onClick={() => {
        const drag = dragState.current;
        dragState.current = null;
        if (!drag?.moved) {
          showExpression("talking");
          onOpen();
        }
      }}
      aria-label={`打开${identity.name}`}
      title="拖动我到任意位置，点击打开小助手"
    >
      {hasCustomSprite && identity.sprite ? (
        <span className="reader-assistant-companion-avatar" aria-hidden="true"><span className="reader-assistant-sprite" style={frameStyle(identity.sprite, spriteUrl, expression)} /></span>
      ) : (
        <>
          <span className="reader-assistant-companion-avatar" aria-hidden="true"><b>{identity.avatar}</b></span>
          <span><b>{identity.name}</b><small>点击和我一起读</small></span>
          <MessageCircle size={15} aria-hidden="true" />
        </>
      )}
    </button>
  );
}