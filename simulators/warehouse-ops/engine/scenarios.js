import { normalizeScenarioConfig } from "./model.js";

export async function loadScenarios() {
  const res = await fetch("./data/scenarios.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load scenarios.json: HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.scenarios) ? data.scenarios : [];
  return list.map((s) => ({
    id: String(s.id || ""),
    title: String(s.title || s.id || "scenario"),
    description: String(s.description || ""),
    config: normalizeScenarioConfig(s.config || {}),
  })).filter((s) => s.id);
}

export function windowsStringToMinutes(str) {
  // "09:00, 13:00, 18:30" -> [540, 780, 1110]
  const s = String(str || "").trim();
  if (!s) return [];
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(p);
    if (!m) continue;
    const hh = Math.max(0, Math.min(23, Number(m[1]) | 0));
    const mm = Math.max(0, Math.min(59, Number(m[2]) | 0));
    out.push(hh * 60 + mm);
  }
  // unique + sorted
  out.sort((a, b) => a - b);
  const uniq = [];
  for (let i = 0; i < out.length; i++) if (i === 0 || out[i] !== out[i - 1]) uniq.push(out[i]);
  return uniq.slice(0, 12);
}

export function windowsMinutesToString(mins) {
  const a = Array.isArray(mins) ? mins : [];
  return a.map((m) => {
    const mm = (Number(m) | 0) % 1440;
    const hh = Math.floor(mm / 60);
    const mi = mm % 60;
    return `${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }).join(", ");
}

