import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { canvasResolution } from "../canvasSizing.js";
import "../tapestryCanvas.css";

function curve(e) {
  const { from: a, to: b, bend } = e;
  if (a.id === b.id) return { x: a.x + 16, y: a.y - 24 };
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1;
  return {
    x: (a.x + b.x) / 2 - (dy / d) * bend,
    y: (a.y + b.y) / 2 + (dx / d) * bend,
  };
}

const TapestryCanvas = forwardRef(function TapestryCanvas(
  {
    scene,
    selected,
    activeEdge,
    onNode,
    onEdge,
    revision,
    onZoom,
    enhanced = false,
    cameraKey = "hf-tapestry-camera",
  },
  ref,
) {
  const canvas = useRef(null),
    holder = useRef(null),
    zoomer = useRef(null);
  const camera = useRef(zoomIdentity),
    frame = useRef(null),
    current = useRef({});
  const [size, setSize] = useState({ width: 1, height: 1 });
  const hovered = useRef(null),
    fitScale = useRef(1);
  const savedCamera = useRef(undefined);
  if (savedCamera.current === undefined) {
    try {
      savedCamera.current = JSON.parse(
        sessionStorage.getItem(cameraKey) || "null",
      );
    } catch {
      savedCamera.current = null;
    }
  }
  current.current = {
    scene,
    selected,
    activeEdge,
    onNode,
    onEdge,
    onZoom,
    size,
  };

  function draw() {
    const c = canvas.current;
    if (!c) return;
    const {
      scene: s,
      selected: chosen,
      activeEdge: edgeId,
      size: v,
    } = current.current;
    const ctx = c.getContext("2d");
    if (!ctx || v.width < 1 || v.height < 1) return;
    ctx.setTransform(c.width / v.width, 0, 0, c.height / v.height, 0, 0);
    ctx.clearRect(0, 0, v.width, v.height);
    const t = camera.current;
    const adjacent = new Set(
      s.edges
        .filter((e) => e.source === chosen || e.target === chosen)
        .flatMap((e) => [e.source, e.target]),
    );
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);
    for (const e of s.edges) {
      const focused =
        e.id === edgeId ||
        (chosen && (e.source === chosen || e.target === chosen));
      ctx.globalAlpha = focused ? 0.77 : chosen ? 0.035 : 0.17;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = (focused ? 1.2 : 0.6) / Math.sqrt(t.k);
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      const p = curve(e);
      if (e.from.id === e.to.id)
        ctx.bezierCurveTo(p.x + 25, p.y, p.x - 25, p.y, e.from.x, e.from.y);
      else ctx.quadraticCurveTo(p.x, p.y, e.to.x, e.to.y);
      ctx.stroke();
    }
    const ranked = [...s.nodes].sort(
      (a, b) => b.connection_count - a.connection_count,
    );
    const regionalLabels = [];
    const labelledRegions = new Set();
    for (const node of ranked) {
      if (!labelledRegions.has(node.region)) {
        regionalLabels.push(node);
        labelledRegions.add(node.region);
      }
    }
    const neighborhoodLabels = [],
      labelledDossiers = new Set();
    if (enhanced)
      for (const node of ranked) {
        const dossier = node.appearances[0]?.dossier;
        if (dossier && !labelledDossiers.has(dossier)) {
          neighborhoodLabels.push(node);
          labelledDossiers.add(dossier);
        }
        if (neighborhoodLabels.length >= 22) break;
      }
    const labels = new Set(
      (enhanced
        ? neighborhoodLabels
        : t.k > fitScale.current * 2
          ? ranked.slice(0, 20)
          : regionalLabels
      ).map((n) => n.id),
    );
    const labelCandidates = [];
    for (const n of s.nodes) {
      const focus = n.id === chosen || n.id === hovered.current;
      ctx.globalAlpha = !chosen || focus || adjacent.has(n.id) ? 1 : 0.18;
      const r =
        (enhanced ? (focus ? 6.5 : 4) : focus ? n.radius + 2.4 : n.radius) /
        Math.pow(t.k, 0.3);
      ctx.fillStyle = n.color;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = enhanced ? (focus ? 8 : 0) : focus ? 18 : 7;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (focus) {
        ctx.strokeStyle = "#f2f2e9";
        ctx.lineWidth = 1 / t.k;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4 / t.k, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (focus || (labels.has(n.id) && (!chosen || adjacent.has(n.id)))) {
        labelCandidates.push({ n, focus, r: r * t.k });
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const occupied = [];
    labelCandidates.sort(
      (a, b) =>
        Number(b.focus) - Number(a.focus) ||
        b.n.connection_count - a.n.connection_count,
    );
    for (const { n, focus, r } of labelCandidates) {
      ctx.font = `${focus ? 13 : 11}px ${enhanced ? "Inter,Arial,sans-serif" : "Georgia,serif"}`;
      const w = ctx.measureText(n.label).width,
        x = n.x * t.k + t.x,
        y = n.y * t.k + t.y;
      if (x < 0 || x > v.width || y < 0 || y > v.height) continue;
      const placements = [
        [x + r + 7, y + 4],
        [x - w - r - 7, y + 4],
        [x - w / 2, y - r - 9],
        [x - w / 2, y + r + 20],
      ];
      const place = placements.find(
        ([px, py]) =>
          px >= 8 &&
          px + w <= v.width - 8 &&
          py >= 16 &&
          py <= v.height - 8 &&
          !occupied.some(
            (b) =>
              px < b.x + b.w + 6 &&
              px + w + 6 > b.x &&
              py - 12 < b.y + b.h + 6 &&
              py + 6 > b.y,
          ),
      );
      if (!place) continue;
      const [px, py] = place;
      occupied.push({ x: px, y: py - 12, w, h: 16 });
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#10181a";
      ctx.strokeText(n.label, px, py);
      ctx.fillStyle = focus ? "#fff6da" : "#d5dddc";
      ctx.fillText(n.label, px, py);
    }
  }
  function redraw() {
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        draw();
      });
  }
  function setCamera(t) {
    if (zoomer.current)
      select(canvas.current).call(zoomer.current.transform, t);
  }
  function fit() {
    const { scene: s, size: v } = current.current;
    if (!s.nodes.length || v.width < 2) return;
    const xs = s.nodes.map((n) => n.x),
      ys = s.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60,
      maxX = Math.max(...xs) + 60,
      minY = Math.min(...ys) - 60,
      maxY = Math.max(...ys) + 60;
    const k =
      Math.min(v.width / (maxX - minX), v.height / (maxY - minY)) * 0.87;
    fitScale.current = k;
    setCamera(
      zoomIdentity
        .translate(
          v.width / 2 - ((minX + maxX) / 2) * k,
          v.height / 2 - ((minY + maxY) / 2) * k,
        )
        .scale(k),
    );
  }
  useImperativeHandle(ref, () => ({
    fit,
    zoom: (amount) => {
      const { width, height } = current.current.size,
        t = camera.current;
      const k = Math.max(0.02, Math.min(12, t.k * amount));
      setCamera(
        zoomIdentity
          .translate(
            width / 2 - ((width / 2 - t.x) * k) / t.k,
            height / 2 - ((height / 2 - t.y) * k) / t.k,
          )
          .scale(k),
      );
    },
    focus: (identity) => {
      const n = current.current.scene.index.get(identity);
      if (!n) return;
      const { width, height } = current.current.size,
        k = Math.max(fitScale.current * 2.7, 0.7);
      setCamera(
        zoomIdentity
          .translate(width / 2 - n.x * k, height / 2 - n.y * k)
          .scale(k),
      );
    },
  }));
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (![width, height].every(Number.isFinite)) return;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous : { width, height },
      );
    });
    obs.observe(holder.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const behavior = zoom()
      .scaleExtent([0.02, 12])
      .on("zoom", (event) => {
        camera.current = event.transform;
        current.current.onZoom?.(event.transform.k / fitScale.current);
        try {
          sessionStorage.setItem(
            cameraKey,
            JSON.stringify({
              revision,
              ...event.transform,
              ...current.current.size,
            }),
          );
        } catch {
          /* Storage can be disabled. */
        }
        redraw();
      });
    zoomer.current = behavior;
    select(canvas.current).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(canvas.current).on(".zoom", null);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [revision, cameraKey]);
  const initialized = useRef(false);
  useEffect(() => {
    const resolution = canvasResolution(size.width, size.height, window.devicePixelRatio);
    canvas.current.width = resolution.width;
    canvas.current.height = resolution.height;
    if (size.width > 1 && size.height > 1) {
      if (!initialized.current) {
        fit();
        try {
          const saved = savedCamera.current;
          if (
            saved?.revision === revision &&
            Math.abs(saved.width - size.width) < 2 &&
            Math.abs(saved.height - size.height) < 2 &&
            [saved.x, saved.y, saved.k].every(Number.isFinite) &&
            saved.k > 0.02 &&
            saved.k < 12
          )
            setCamera(zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
        } catch {
          /* A bad stored camera must not prevent the graph from opening. */
        }
        initialized.current = true;
      } else fit();
    }
    redraw();
  }, [size.width, size.height]);
  useEffect(redraw, [scene, selected, activeEdge]);
  function hit(event, edges = false) {
    const box = canvas.current.getBoundingClientRect(),
      t = camera.current;
    const x = (event.clientX - box.left - t.x) / t.k,
      y = (event.clientY - box.top - t.y) / t.k;
    let found = null,
      distance = Infinity;
    for (const n of current.current.scene.nodes) {
      const d = Math.hypot(n.x - x, n.y - y),
        radius = Math.max(10 / t.k, n.radius / Math.pow(t.k, 0.3) + 5 / t.k);
      if (d < radius && d < distance) {
        found = n;
        distance = d;
      }
    }
    if (found || !edges) return found ? { node: found } : null;
    for (const e of current.current.scene.edges) {
      const p = curve(e);
      for (let j = 1; j < 16; j++) {
        const a = j / 16,
          b = 1 - a,
          px = b * b * e.from.x + 2 * b * a * p.x + a * a * e.to.x,
          py = b * b * e.from.y + 2 * b * a * p.y + a * a * e.to.y;
        const d = Math.hypot(x - px, y - py);
        if (d < 5 / t.k && d < distance) {
          found = e;
          distance = d;
        }
      }
    }
    return found ? { edge: found } : null;
  }
  return (
    <div className="tapestry-canvas" ref={holder}>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="img"
        aria-label={`Living Tapestry: ${scene.nodes.length} entities and ${scene.edges.length} sourced connections. Entity search and the browse list provide a keyboard alternative.`}
        onMouseMove={(event) => {
          const h = hit(event);
          hovered.current = h?.node.id || null;
          canvas.current.style.cursor = h ? "pointer" : "grab";
          redraw();
        }}
        onMouseLeave={() => {
          hovered.current = null;
          redraw();
        }}
        onClick={(event) => {
          const h = hit(event, true);
          if (h?.node) onNode(h.node.id);
          else if (h?.edge) onEdge(h.edge.id);
        }}
        onKeyDown={(event) => {
          const shifts = {
            ArrowLeft: [60, 0],
            ArrowRight: [-60, 0],
            ArrowUp: [0, 60],
            ArrowDown: [0, -60],
          };
          if (shifts[event.key]) {
            event.preventDefault();
            const [x, y] = shifts[event.key];
            setCamera(
              camera.current.translate(
                x / camera.current.k,
                y / camera.current.k,
              ),
            );
          } else if (event.key === "Home") {
            event.preventDefault();
            fit();
          } else if (["+", "=", "-"].includes(event.key)) {
            event.preventDefault();
            select(canvas.current).call(
              zoomer.current.scaleBy,
              event.key === "-" ? 0.8 : 1.25,
            );
          }
        }}
      />
    </div>
  );
});
export default TapestryCanvas;
