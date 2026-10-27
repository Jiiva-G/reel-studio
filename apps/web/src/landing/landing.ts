import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/800.css";
import "@fontsource/space-grotesk/700.css";
import "./landing.css";
import rules from "../../../../schema/rules.json";

document.body.classList.remove("no-js");
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// "Write a hook": the engine's own limit (schema/rules.json) and estimate (script.estimate_seconds)
const LIMIT = rules.limits.hook_heading;
const input = $<HTMLInputElement>("hook");
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
function renderHook() {
  const raw = input.value;
  const plain = raw.replace(/\*/g, "");
  $("mirror").innerHTML = esc(raw).replace(/\*([^*]+)\*/g, '<span class="star">*</span><em>$1</em><span class="star">*</span>') || "&nbsp;";
  $("scene-head").innerHTML = esc(raw).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\*/g, "");
  $("scene-cap").textContent = plain.split(" ").slice(0, 5).join(" ");
  const len = plain.length;
  const ok = len > 0 && len <= LIMIT;
  $("f-len").textContent = `${len} of ${LIMIT} characters`;
  $("f-time").textContent = `${Math.max(2, len / 14 + 0.6).toFixed(1)} s`;
  const acc = (raw.match(/\*([^*]+)\*/g) ?? []).map((w) => w.replace(/\*/g, ""));
  $("f-accent").textContent = acc.length ? acc.join(", ") : "None: wrap a word in *asterisks*";
  const c = $("f-check");
  c.className = ok ? "" : "bad";
  c.textContent = len === 0 ? "Scene 1 (hook): missing on_screen.heading." : ok ? "Ready to render" : `Scene 1 (hook): heading too long (${len} > ${LIMIT}).`;
}
input.addEventListener("input", renderHook);
document.querySelectorAll<HTMLButtonElement>(".examples button").forEach((b) =>
  b.addEventListener("click", () => { input.value = b.textContent ?? ""; renderHook(); input.focus(); }));
renderHook();

// feature switches
document.querySelectorAll<HTMLButtonElement>(".switch").forEach((s) =>
  s.addEventListener("click", () => {
    const on = s.getAttribute("aria-checked") !== "true";
    s.setAttribute("aria-checked", String(on));
    s.closest(".band")?.classList.toggle("on", on);
  }));

// "Start your first reel": the choice goes to /app/?new=sample|blank&name=…
document.querySelectorAll<HTMLButtonElement>(".seg-ctl button").forEach((b) =>
  b.addEventListener("click", () => {
    b.parentElement?.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $<HTMLInputElement>("start-kind").value = b.dataset.kind ?? "sample";
    $("start-hint").textContent = b.dataset.kind === "blank" ? "Starts with a hook, one scene and an end card." : "The sample is a 7-scene reel you can edit.";
  }));

// entrances: each section's parts rise in, once
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.querySelectorAll(".rise").forEach((el, i) => setTimeout(() => el.classList.add("in"), i * 80));
  io.unobserve(e.target);
}), { threshold: 0.15 });
document.querySelectorAll("main section, footer").forEach((s) => io.observe(s));
