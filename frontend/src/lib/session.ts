// Portal sessions live in sessionStorage: they end when the tab closes. Demo-grade, not auth.
export type Session =
  | { kind: "citizen"; name: string; email: string }
  | { kind: "operator"; badge_id: string; name: string; department: string };

const KEY = "converge.session";

export function readSession(kind: Session["kind"]): Session | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.kind === kind ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the user simply has to sign in again next time.
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
