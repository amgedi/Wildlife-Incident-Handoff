/**
 * ContextMenu (0.3.0-dev.6, Part XII): a shared elevated application context
 * menu. Never blocks native menus inside text inputs/textareas/editable
 * content — callers must respect that rule (see useAppContextMenu).
 *
 * Keyboard: ArrowUp/Down navigate, Enter activates, Escape closes. Every
 * right-click action must also exist as ordinary UI — the menu is a
 * convenience, never exclusive functionality.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "../../components/Icons";

export interface ContextMenuItem {
  icon?: keyof typeof Icons;
  label: string;
  onSelect: () => void;
  /** Disabled entries render inert but keep the layout stable. */
  disabled?: boolean;
}

interface State {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function useAppContextMenu() {
  const [state, setState] = useState<State | null>(null);

  const open = (e: { clientX: number; clientY: number; preventDefault: () => void; target?: EventTarget | null }, items: ContextMenuItem[]) => {
    // Rule (spec 58): inside text inputs / textareas / editable content the
    // native editing menu (cut/copy/paste/select-all) must survive.
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    if (items.length === 0) return;
    e.preventDefault();
    setState({ x: e.clientX, y: e.clientY, items });
  };

  return { menu: state, open, close: () => setState(null) };
}

export function AppContextMenu({ state, onClose }: { state: State | null; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (!state) return;
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [state, onClose]);

  if (!state) return null;

  const items = state.items;
  const clamp = (n: number) => Math.max(0, Math.min(items.length - 1, n));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => clamp(i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => clamp(i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); items[index]?.onSelect(); onClose(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  const x = Math.min(state.x, window.innerWidth - 220);
  const y = Math.min(state.y, window.innerHeight - items.length * 34 - 24);

  return createPortal(
    <div
      className="ctx-scrim"
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      onClick={onClose}
    >
      <div
        className="ctx-menu"
        role="menu"
        tabIndex={-1}
        autoFocus
        style={{ left: x, top: y }}
        onKeyDown={onKeyDown}
        ref={(el) => el?.focus()}
      >
        {items.map((item, i) => {
          const Icon = item.icon ? (Icons[item.icon] as React.ComponentType<{ size?: number }>) : null;
          return (
            <button
              key={item.label}
              role="menuitem"
              className={`ctx-item${i === index ? " focused" : ""}`}
              disabled={item.disabled}
              onMouseEnter={() => setIndex(i)}
              onClick={() => { item.onSelect(); onClose(); }}
            >
              {Icon ? <Icon size={14} /> : <span className="ctx-spacer" />}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
