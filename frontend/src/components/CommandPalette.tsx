"use client";

import { CornerDownLeft, LogOut, Search, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Incident } from "@/lib/types";

import { CategoryGlyph, Kbd, useFocusTrap, usePresence } from "./OpUi";
import { sortIncidents } from "./IncidentQueue";

export type PaletteTab = { id: string; label: string; icon: LucideIcon; blurb: string };

type Item =
  | { kind: "tab"; id: string; label: string; hint: string; icon: LucideIcon }
  | { kind: "incident"; id: string; label: string; hint: string; incident: Incident }
  | { kind: "action"; id: string; label: string; hint: string; icon: LucideIcon };

/** Ctrl/Cmd+K: jump to any section or case by typing. */
export function CommandPalette({
  open,
  onClose,
  tabs,
  incidents,
  onTab,
  onIncident,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  tabs: readonly PaletteTab[];
  incidents: Incident[];
  onTab: (id: string) => void;
  onIncident: (id: string) => void;
  onSignOut?: () => void;
}) {
  const { mounted, closing } = usePresence(open, 150);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setCursor(0);
    }
  }
  useFocusTrap(ref, open);

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    const t: Item[] = tabs
      .filter((x) => match(`${x.label} ${x.blurb}`))
      .map((x) => ({ kind: "tab", id: x.id, label: `Go to ${x.label}`, hint: x.blurb, icon: x.icon }));
    const inc: Item[] = sortIncidents(incidents)
      .filter((i) => match(`${i.id} ${i.title} ${i.department} ${CATEGORY_LABEL[i.category]} ${STATUS_LABEL[i.status]}`))
      .slice(0, term ? 12 : 6)
      .map((i) => ({ kind: "incident", id: i.id, label: i.title, hint: `${i.id} · ${STATUS_LABEL[i.status]}`, incident: i }));
    const a: Item[] =
      onSignOut && match("sign out log out") ? [{ kind: "action", id: "signout", label: "Sign out", hint: "End this operator session", icon: LogOut }] : [];
    return [...t, ...inc, ...a];
  }, [q, tabs, incidents, onSignOut]);

  const active = Math.min(cursor, Math.max(0, items.length - 1));

  const run = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    if (item.kind === "tab") onTab(item.id);
    else if (item.kind === "incident") onIncident(item.id);
    else onSignOut?.();
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  let lastKind: Item["kind"] | null = null;
  const HEAD: Record<Item["kind"], string> = { tab: "Sections", incident: "Cases", action: "Session" };

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[12vh]">
      <div className={`absolute inset-0 bg-[#02040a]/70 backdrop-blur-sm ${closing ? "op-fade-out" : "op-fade-in"}`} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKey}
        className={`relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] ${closing ? "op-pop-out" : "op-pop-in"}`}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            data-autofocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="Search cases by ID or title, or jump to a section…"
            aria-label="Search commands"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-slate-500 outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul ref={listRef} className="op-scroll max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No matches for “{q}”.</li>}
          {items.map((item, idx) => {
            const header = item.kind !== lastKind ? HEAD[item.kind] : null;
            lastKind = item.kind;
            const on = idx === active;
            return (
              <li key={`${item.kind}-${item.id}`} role="presentation">
                {header && <p className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-idx={idx}
                  onMouseMove={() => setCursor(idx)}
                  onClick={() => run(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-accent/15" : ""}`}
                >
                  {item.kind === "incident" ? (
                    <CategoryGlyph category={item.incident.category} size="sm" />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-line">
                      <item.icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{item.label}</span>
                    <span className="block truncate text-[11px] text-muted">{item.hint}</span>
                  </span>
                  {on && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-[#0a0f1b] px-4 py-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto">CONVERGE command</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
