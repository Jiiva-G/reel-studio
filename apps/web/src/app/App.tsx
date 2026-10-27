import React, { lazy, Suspense, useEffect, useState } from "react";
import { Dashboard } from "./Dashboard";
import { ToastHost } from "./ui";
import { blankProject, sampleProject } from "../lib/samples";
import { saveProject } from "../lib/storage";

const Workspace = lazy(() => import("./Workspace"));
export const STEPS = ["script", "storyboard", "brand", "export"] as const;
export type Step = (typeof STEPS)[number];

type Route = { name: "home" } | { name: "project"; id: string; step: Step };

function parse(hash: string): Route {
  const m = hash.match(/^#\/p\/([^/]+)(?:\/(\w+))?/);
  if (m) return { name: "project", id: decodeURIComponent(m[1]), step: (STEPS as readonly string[]).includes(m[2]) ? (m[2] as Step) : "storyboard" };
  return { name: "home" };
}

export const go = (r: Route) => {
  location.hash = r.name === "home" ? "#/" : `#/p/${encodeURIComponent(r.id)}/${r.step}`;
};

/** Links from the website (/app/?new=sample&name=…) create a project, then open it. */
async function handleIncoming(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const kind = q.get("new");
  if (kind !== "sample" && kind !== "blank") return;
  const name = (q.get("name") ?? "").slice(0, 120);
  const p = kind === "sample" ? sampleProject(name || undefined) : blankProject(name || "Untitled reel");
  await saveProject(p);
  history.replaceState(null, "", `${location.pathname}#/p/${p.id}/storyboard`);
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    handleIncoming().catch(() => {}).finally(() => { setRoute(parse(location.hash)); setReady(true); });
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (!ready) return null;
  return (
    <ToastHost>
      <a className="skip" href="#main">Skip to content</a>
      {route.name === "home" ? (
        <Dashboard />
      ) : (
        <Suspense fallback={<div className="center-msg">Opening the project…</div>}>
          <Workspace key={route.id} id={route.id} step={route.step} />
        </Suspense>
      )}
    </ToastHost>
  );
};
