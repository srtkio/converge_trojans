"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { BottomNav, type Tab } from "@/components/BottomNav";
import { CitizenLogin, type Citizen } from "@/components/CitizenLogin";
import { InAppShellContext } from "@/components/CitizenShell";
import { api } from "@/lib/api";
import { forgetDevice, needsCheck } from "@/lib/citizen";
import { resetMyCases, startMyCases, useMyCases } from "@/lib/myCases";
import { clearSession, readSession } from "@/lib/session";

const CitizenContext = createContext<Citizen | null>(null);

/** The signed-in citizen. Only screens under the /citizen layout (behind the sign-in gate) use it. */
export function useCitizen(): Citizen {
  const c = use(CitizenContext);
  if (!c) throw new Error("useCitizen() outside the signed-in citizen app");
  return c;
}

function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

/**
 * Light, phone-first frame of the citizen app. It fixes the colours (the global theme turns dark
 * on dark-mode phones), wakes the free backend as soon as the app opens, shows the offline banner,
 * and leaves room for the bottom nav and the home indicator.
 */
function Frame({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const offline = useOffline();

  useEffect(() => {
    api.health().catch(() => {
      // Asleep or offline: the screens' own requests show a friendly message and retry.
    });
  }, []);

  return (
    <InAppShellContext value={true}>
      <div className="min-h-dvh w-full bg-slate-50 bg-[radial-gradient(130%_45%_at_50%_0%,#d1fae5_0%,rgba(248,250,252,0)_70%)] font-sans text-slate-900 antialiased [color-scheme:light]">
        <main
          className={`mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] min-[400px]:pr-[max(1rem,env(safe-area-inset-right))] min-[400px]:pl-[max(1rem,env(safe-area-inset-left))] md:pt-12 ${
            nav ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          }`}
        >
          {offline && (
            <p role="status" className="cz-rise rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
              {"You're offline. Check your connection; this page updates when you're back."}
            </p>
          )}
          {children}
        </main>
        {nav}
      </div>
    </InAppShellContext>
  );
}

function useMyCasesPoll(on: boolean) {
  useEffect(() => (on ? startMyCases() : undefined), [on]);
  return useMyCases().cases.filter(needsCheck).length;
}

/** /citizen, /citizen/cases, /citizen/map: sign-in gate, greeting, tabs. */
export function CitizenTabsApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const active: Tab = segment === "cases" ? "cases" : segment === "map" ? "map" : "report";
  const [citizen, setCitizen] = useState<Citizen | null>(null);
  const [checked, setChecked] = useState(false);
  const toCheck = useMyCasesPoll(!!citizen);

  useEffect(() => {
    // Restore this tab's session. Reading storage needs the browser, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitizen(readSession("citizen") as Citizen | null);
    setChecked(true);
  }, []);

  if (!checked) return <Frame>{null}</Frame>;
  if (!citizen) {
    return (
      <Frame>
        <CitizenLogin onSignedIn={setCitizen} />
      </Frame>
    );
  }

  const signOut = () => {
    clearSession();
    forgetDevice(); // shared phones: the next person starts fresh
    resetMyCases();
    setCitizen(null);
    router.replace("/citizen");
  };

  return (
    <CitizenContext value={citizen}>
      <Frame nav={<BottomNav active={active} needsCheck={toCheck} />}>
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Citizen portal</p>
            <p className="truncate text-lg font-semibold">Hi, {citizen.name}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            Sign out
          </button>
        </header>
        {children}
      </Frame>
    </CitizenContext>
  );
}

/** /track/[id]: public (shared links work without signing in), no greeting, nav on My cases. */
export function CitizenPublicApp({ children }: { children: ReactNode }) {
  const toCheck = useMyCasesPoll(true);
  return <Frame nav={<BottomNav active="cases" current={false} needsCheck={toCheck} />}>{children}</Frame>;
}
