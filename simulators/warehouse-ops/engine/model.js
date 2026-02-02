export const STAGES = {
  INBOUND: 0,
  STORAGE: 1,
  PICK: 2,
  PACK: 3,
  OUTBOUND: 4,
  SHIPPED: 5,
};

export const STAGE_NAMES = ["INBOUND", "STORAGE", "PICK", "PACK", "OUTBOUND", "SHIPPED"];

export const STAGE_COLORS = [
  "#2563eb", // inbound
  "#7c3aed", // storage
  "#f59e0b", // pick
  "#10b981", // pack
  "#64748b", // outbound
  "#111827", // shipped
];

export function defaultConfig() {
  return {
    horizonMin: 1440,
    arrivalRatePerHour: 30,
    slaHours: 24,
    workers: { inbound: 3, storage: 2, pick: 6, pack: 5, outbound: 3 },
    proc: {
      inboundMean: 6,
      inboundJitter: 0.4,
      storageMean: 3,
      storageJitter: 0.4,
      pickMean: 10,
      pickJitter: 0.5,
      packMean: 8,
      packJitter: 0.5,
      outboundMean: 5,
      outboundJitter: 0.4,
    },
    limits: { storageWipCap: 180 },
    carrier: { mode: "interval", intervalMin: 60, capacityPerDeparture: 120, windows: [] },
  };
}

export function normalizeScenarioConfig(raw) {
  const cfg = defaultConfig();
  const r = raw || {};

  cfg.horizonMin = Number(r.horizon_min ?? r.horizonMin ?? cfg.horizonMin) | 0;
  cfg.arrivalRatePerHour = Number(r.arrival_rate_per_hour ?? r.arrivalRatePerHour ?? cfg.arrivalRatePerHour);
  cfg.slaHours = Number(r.sla_hours ?? r.slaHours ?? cfg.slaHours);

  const w = r.workers || {};
  cfg.workers.inbound = Number(w.inbound ?? cfg.workers.inbound) | 0;
  cfg.workers.storage = Number(w.storage ?? cfg.workers.storage) | 0;
  cfg.workers.pick = Number(w.pick ?? cfg.workers.pick) | 0;
  cfg.workers.pack = Number(w.pack ?? cfg.workers.pack) | 0;
  cfg.workers.outbound = Number(w.outbound ?? cfg.workers.outbound) | 0;

  const p = r.proc_min || r.proc || {};
  cfg.proc.inboundMean = Number(p.inbound_mean ?? p.inboundMean ?? cfg.proc.inboundMean);
  cfg.proc.inboundJitter = Number(p.inbound_jitter ?? p.inboundJitter ?? cfg.proc.inboundJitter);
  cfg.proc.storageMean = Number(p.storage_mean ?? p.storageMean ?? cfg.proc.storageMean);
  cfg.proc.storageJitter = Number(p.storage_jitter ?? p.storageJitter ?? cfg.proc.storageJitter);
  cfg.proc.pickMean = Number(p.pick_mean ?? p.pickMean ?? cfg.proc.pickMean);
  cfg.proc.pickJitter = Number(p.pick_jitter ?? p.pickJitter ?? cfg.proc.pickJitter);
  cfg.proc.packMean = Number(p.pack_mean ?? p.packMean ?? cfg.proc.packMean);
  cfg.proc.packJitter = Number(p.pack_jitter ?? p.packJitter ?? cfg.proc.packJitter);
  cfg.proc.outboundMean = Number(p.outbound_mean ?? p.outboundMean ?? cfg.proc.outboundMean);
  cfg.proc.outboundJitter = Number(p.outbound_jitter ?? p.outboundJitter ?? cfg.proc.outboundJitter);

  const lim = r.limits || {};
  cfg.limits.storageWipCap = Number(lim.storage_wip_cap ?? lim.storageWipCap ?? cfg.limits.storageWipCap) | 0;

  const c = r.carrier || {};
  cfg.carrier.mode = String(c.mode ?? cfg.carrier.mode);
  cfg.carrier.intervalMin = Number(c.interval_min ?? c.intervalMin ?? cfg.carrier.intervalMin) | 0;
  cfg.carrier.capacityPerDeparture = Number(c.capacity_per_departure ?? c.capacityPerDeparture ?? cfg.carrier.capacityPerDeparture) | 0;
  cfg.carrier.windows = Array.isArray(c.windows) ? c.windows.slice(0, 12) : [];

  // Basic clamps
  if (cfg.horizonMin < 60) cfg.horizonMin = 60;
  if (cfg.horizonMin > 7 * 24 * 60) cfg.horizonMin = 7 * 24 * 60;
  if (cfg.arrivalRatePerHour < 0) cfg.arrivalRatePerHour = 0;
  if (cfg.slaHours < 1) cfg.slaHours = 1;
  for (const k of ["inbound", "storage", "pick", "pack", "outbound"]) {
    if (cfg.workers[k] < 0) cfg.workers[k] = 0;
    if (cfg.workers[k] > 200) cfg.workers[k] = 200;
  }
  if (cfg.limits.storageWipCap < 0) cfg.limits.storageWipCap = 0;
  if (cfg.limits.storageWipCap > 5000) cfg.limits.storageWipCap = 5000;
  if (cfg.carrier.intervalMin < 10) cfg.carrier.intervalMin = 10;
  if (cfg.carrier.intervalMin > 24 * 60) cfg.carrier.intervalMin = 24 * 60;
  if (cfg.carrier.capacityPerDeparture < 0) cfg.carrier.capacityPerDeparture = 0;
  if (cfg.carrier.capacityPerDeparture > 5000) cfg.carrier.capacityPerDeparture = 5000;
  return cfg;
}

