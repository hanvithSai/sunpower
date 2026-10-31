"use client";

/**
 * How energy moves through a rooftop system — the landing page's centrepiece.
 *
 * The two systems SunPower installs (On-Grid, Off-Grid) × three moments
 * (sunny afternoon, evening, power cut). Each moment lights the paths electricity
 * actually takes, with arrows for direction; every part is a button that
 * explains itself. It is an explainer, not monitoring: no kW figures are
 * invented — every sentence describes how the system behaves.
 *
 * Layout: an SVG layer (viewBox 600×440) draws the wires; the parts are HTML
 * buttons positioned at the same coordinates (as percentages), so they stay
 * keyboard- and screen-reader-friendly. Motion is a CSS dash animation that
 * the global reduced-motion rule freezes, leaving the arrows.
 */
import { useId, useState } from "react";
import { BatteryCharging, Cpu, Gauge, House, Moon, SolarPanel, SunMedium, UtilityPole, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "on_grid" | "off_grid";
type Moment = "day" | "evening" | "outage";
type NodeId = "sun" | "panels" | "controller" | "inverter" | "battery" | "home" | "grid";

const W = 600;
const H = 440;

const POS: Record<NodeId, { x: number; y: number }> = {
  sun: { x: 78, y: 72 },
  panels: { x: 250, y: 92 },
  controller: { x: 104, y: 236 },
  inverter: { x: 300, y: 236 },
  battery: { x: 300, y: 384 },
  home: { x: 512, y: 236 },
  grid: { x: 512, y: 384 },
};

type Part = { label: string; icon: LucideIcon; about: string };

const PARTS: Record<Mode, Partial<Record<NodeId, Part>>> = {
  on_grid: {
    sun: { label: "Sunlight", icon: SunMedium, about: "The fuel. Panels produce the most around midday and nothing after dark." },
    panels: { label: "Solar panels", icon: SolarPanel, about: "Turn sunlight into direct current (DC). Each panel is tracked by its serial number with a 20-year warranty." },
    inverter: { label: "Grid-tie inverter", icon: Cpu, about: "Converts the panels' DC into the AC your home uses, and keeps it in step with the grid." },
    home: { label: "Your home", icon: House, about: "Uses solar power first. The net meter at your board records what you take from and give to the grid." },
    grid: { label: "Utility grid", icon: UtilityPole, about: "Takes your extra units during the day (credited by net metering) and supplies you at night." },
  },
  off_grid: {
    sun: { label: "Sunlight", icon: SunMedium, about: "The fuel. Off-grid systems are sized so the battery fills on an average day." },
    panels: { label: "Solar panels", icon: SolarPanel, about: "Turn sunlight into DC. Each panel is tracked by its serial number with a 20-year warranty." },
    controller: { label: "Charge controller", icon: Gauge, about: "An MPPT controller squeezes the most out of the panels and charges the battery safely." },
    battery: { label: "Battery bank", icon: BatteryCharging, about: "Stores the day's energy so the home keeps running after sunset. Batteries carry a 2-year warranty." },
    inverter: { label: "Inverter (PCU)", icon: Cpu, about: "Turns stored DC into AC for the home's appliances." },
    home: { label: "Your home", icon: House, about: "Runs only on what the panels and battery provide — there is no grid connection." },
  },
};

type Edge = { from: NodeId; to: NodeId; kind?: "light" };
type Scene = { edges: Edge[]; off?: NodeId[]; tags?: Partial<Record<NodeId, string>>; story: string };

const SCENES: Record<Mode, Record<Moment, Scene>> = {
  on_grid: {
    day: {
      edges: [{ from: "sun", to: "panels", kind: "light" }, { from: "panels", to: "inverter" }, { from: "inverter", to: "home" }, { from: "home", to: "grid" }],
      tags: { grid: "Exporting" },
      story: "Your panels power the home, and the extra units flow out to the grid. The net meter counts them against your bill.",
    },
    evening: {
      edges: [{ from: "grid", to: "home" }],
      off: ["sun", "panels", "inverter"],
      tags: { grid: "Importing" },
      story: "No sun, so the panels rest and the home draws from the grid — paid for with the units you exported during the day.",
    },
    outage: {
      edges: [{ from: "sun", to: "panels", kind: "light" }],
      off: ["inverter", "home", "grid"],
      tags: { inverter: "Switched off", grid: "Outage" },
      story: "A grid-tie inverter switches itself off during a power cut, even in full sun, so no power flows back to line workers. Backup needs a battery system.",
    },
  },
  off_grid: {
    day: {
      edges: [{ from: "sun", to: "panels", kind: "light" }, { from: "panels", to: "controller" }, { from: "controller", to: "battery" }, { from: "battery", to: "inverter" }, { from: "inverter", to: "home" }],
      tags: { battery: "Charging" },
      story: "The panels charge the battery through the controller while the home runs on the inverter.",
    },
    evening: {
      edges: [{ from: "battery", to: "inverter" }, { from: "inverter", to: "home" }],
      off: ["sun", "panels", "controller"],
      tags: { battery: "Discharging" },
      story: "After sunset the battery takes over. How long it lasts depends on its size and what is switched on.",
    },
    outage: {
      edges: [{ from: "sun", to: "panels", kind: "light" }, { from: "panels", to: "controller" }, { from: "controller", to: "battery" }, { from: "battery", to: "inverter" }, { from: "inverter", to: "home" }],
      tags: { battery: "Charging" },
      story: "A power cut changes nothing — an off-grid home was never connected to the grid.",
    },
  },
};

const MODES: { id: Mode; label: string }[] = [
  { id: "on_grid", label: "On-Grid" },
  { id: "off_grid", label: "Off-Grid" },
];

const MOMENTS: { id: Moment; label: string; short: string; icon: LucideIcon }[] = [
  { id: "day", label: "Sunny afternoon", short: "Afternoon", icon: SunMedium },
  { id: "evening", label: "Evening", short: "Evening", icon: Moon },
  { id: "outage", label: "Power cut", short: "Power cut", icon: Zap },
];

const NODE_R = 32;
/** Room for the part's label and status tag below its circle, so wires never cross them. */
const LABEL_H = 34;

/** A gentle curve from one part to another, trimmed so the arrow stops at the part's edge. */
function wire(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const startTrim = NODE_R + (uy > 0.35 ? LABEL_H : 0);
  const endTrim = NODE_R + 6 + (uy < -0.35 ? LABEL_H : 0);
  const sx = a.x + ux * startTrim;
  const sy = a.y + uy * startTrim;
  const ex = b.x - ux * endTrim;
  const ey = b.y - uy * endTrim;
  // Bow the curve slightly to one side so crossing wires stay readable.
  const cx = (sx + ex) / 2 - uy * 18;
  const cy = (sy + ey) / 2 + ux * 18;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export function EnergyFlow({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("on_grid");
  const [moment, setMoment] = useState<Moment>("day");
  const [selected, setSelected] = useState<NodeId | null>(null);
  const arrowId = useId();
  const storyId = useId();

  const parts = PARTS[mode];
  const scene = SCENES[mode][moment];
  const nodes = Object.keys(parts) as NodeId[];
  const off = new Set(scene.off ?? []);
  // Wires that exist in this system, lit or not, so the layout is visible at rest.
  const allWires = wiresFor(mode);
  const picked = selected && parts[selected] ? selected : null;

  return (
    <div className={cn("rounded-2xl bg-forest-2/70 p-4 ring-1 ring-white/10 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="System type" className="inline-flex rounded-lg bg-black/25 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setSelected(null);
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[13px] font-medium transition-colors pointer-coarse:h-10",
                mode === m.id ? "bg-sun text-forest" : "text-forest-foreground/80 hover:text-white",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 aspect-[600/440] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="var(--current)" />
            </marker>
          </defs>
          {allWires.map(([a, b]) => (
            <path key={`${a}-${b}`} d={wire(POS[a], POS[b])} fill="none" stroke="rgb(232 240 233 / 0.14)" strokeWidth="2" />
          ))}
          {scene.edges.map((e) => (
            <path
              key={`${mode}-${moment}-${e.from}-${e.to}`}
              d={wire(POS[e.from], POS[e.to])}
              fill="none"
              stroke={e.kind === "light" ? "var(--brand)" : "var(--current)"}
              strokeWidth={e.kind === "light" ? 2 : 3}
              strokeLinecap="round"
              strokeDasharray={e.kind === "light" ? "1 9" : "2 10"}
              markerEnd={e.kind === "light" ? undefined : `url(#${arrowId})`}
              className="energy-dash"
            />
          ))}
        </svg>

        {nodes.map((id) => {
          const part = parts[id]!;
          const Icon = id === "sun" && moment === "evening" ? Moon : part.icon;
          const isOff = off.has(id);
          const tag = scene.tags?.[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(picked === id ? null : id)}
              aria-pressed={picked === id}
              aria-describedby={storyId}
              aria-label={`${part.label}${tag ? `, ${tag.toLowerCase()}` : ""}${isOff ? ", idle" : ""}. ${part.about}`}
              title={part.label}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl p-1 text-center"
              style={{ left: `${(POS[id].x / W) * 100}%`, top: `${(POS[id].y / H) * 100}%` }}
            >
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-full ring-1 transition-all duration-200 sm:size-14",
                  id === "sun" && moment !== "evening" ? "bg-sun text-forest ring-sun/40" : "bg-forest text-volt ring-white/15",
                  isOff && "opacity-45",
                  picked === id ? "ring-2 ring-sun" : "group-hover:ring-white/40",
                )}
              >
                <Icon className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <span className="text-[11px] leading-tight font-medium whitespace-nowrap text-forest-foreground sm:text-xs">{part.label}</span>
              {tag ? (
                <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] leading-none font-medium whitespace-nowrap text-sun sm:text-[11px]">{tag}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Time of day" className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-black/25 p-1">
        {MOMENTS.map(({ id, label, short, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={moment === id}
            onClick={() => setMoment(id)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors sm:text-[13px] pointer-coarse:h-11",
              moment === id ? "bg-white/12 text-white" : "text-forest-foreground/75 hover:text-white",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate sm:hidden">{short}</span>
            <span className="hidden truncate sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[4.5rem] text-sm leading-relaxed" aria-live="polite">
        {picked ? (
          <p className="text-forest-foreground">
            <span className="font-semibold text-white">{parts[picked]!.label}. </span>
            {parts[picked]!.about}
          </p>
        ) : (
          <p id={storyId} className="text-forest-foreground">
            {scene.story}
          </p>
        )}
      </div>
    </div>
  );
}

/** Every wire a system has, drawn faintly even when no power flows through it. */
function wiresFor(mode: Mode): [NodeId, NodeId][] {
  const seen = new Set<string>();
  const out: [NodeId, NodeId][] = [];
  for (const scene of Object.values(SCENES[mode])) {
    for (const e of scene.edges) {
      const key = [e.from, e.to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([e.from, e.to]);
    }
  }
  return out;
}
