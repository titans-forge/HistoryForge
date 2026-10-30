import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Layers, ListFilter, RotateCcw, RotateCw, X } from "lucide-react";
import {
  nearestSpatialMarks,
  readSpatialCamera,
  selectedPositions,
  spatialRoutes,
  celestialScale,
} from "../tapestrySpatial.js";
import { celestialAtmosphere, celestialSurface } from "../tapestryCelestial.js";
import "../tapestrySpatial.css";

function Button({ label, icon: Icon, ...props }) {
  return (
    <button type="button" title={label} aria-label={label} {...props}>
      <Icon size={17} />
    </button>
  );
}

export default forwardRef(function TapestrySpatial(
  {
    graph,
    positions: allPositions,
    selected,
    activeEdge,
    cacheKey,
    onNode,
    onEdge,
    onUnavailable,
    onZoom,
    onCapacity,
  },
  ref,
) {
  const host = useRef(null),
    api = useRef(null),
    callbacks = useRef({});
  callbacks.current = { onNode, onEdge, onUnavailable, onZoom, onCapacity };
  const [labels, setLabels] = useState([]),
    [bundled, setBundled] = useState(true);
  const [choices, setChoices] = useState(null),
    [groupsOpen, setGroupsOpen] = useState(false);
  const active = graph.edges.find((e) => e.id === activeEdge);
  const positions = useMemo(
    () => selectedPositions(allPositions, active),
    [allPositions, active],
  );
  const routes = useMemo(
    () => spatialRoutes(graph.edges, positions, bundled && !active),
    [graph.edges, positions, bundled, active],
  );
  const groups = routes.filter((route) => route.edges.length > 1);
  const index = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );
  useImperativeHandle(
    ref,
    () => ({
      fit: () => api.current?.fit(),
      zoom: (factor) => api.current?.zoom(factor),
    }),
    [],
  );

  useEffect(() => {
    setChoices(null);
    setGroupsOpen(false);
  }, [graph]);
  useEffect(() => {
    const element = host.current,
      canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
    });
    if (!context) {
      callbacks.current.onUnavailable(
        "3D is unavailable on this browser. Your selection is preserved in 2D.",
      );
      return;
    }
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    } catch {
      callbacks.current.onUnavailable(
        "The 3D renderer could not start. Your selection is preserved in 2D.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearColor("#080b10", 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    canvas.className = "ts-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `Spatial network: ${graph.nodes.length} entities, ${graph.edges.length} sourced connections. Equivalent entities and connections are available in the details panel.`,
    );
    element.prepend(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -500,
      500,
      500,
      -500,
      0.1,
      30000,
    );
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.minZoom = 0.25;
    controls.maxZoom = 16;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI - 0.2;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.65;
    scene.add(new THREE.HemisphereLight(0xd5e5ee, 0x11151c, 0.35));
    const light = new THREE.DirectionalLight(0xfff2dd, 2.4);
    light.position.set(-800, 500, 400);
    scene.add(light);
    const rimLight = new THREE.DirectionalLight(0x8cbbd4, 0.7);
    rimLight.position.set(500, -100, -300);
    scene.add(rimLight);

    const radius = 1;
    const nodes = new THREE.InstancedMesh(
      new THREE.SphereGeometry(radius, 32, 24),
      celestialSurface(),
      graph.nodes.length,
    );
    const atmospheres = new THREE.InstancedMesh(
      nodes.geometry,
      celestialAtmosphere(),
      graph.nodes.length,
    );
    const transform = new THREE.Object3D();
    graph.nodes.forEach((n, i) => {
      const p = positions.get(n.id);
      transform.position.set(p.x, p.y, p.z);
      transform.updateMatrix();
      nodes.setMatrixAt(i, transform.matrix);
      nodes.setColorAt(i, new THREE.Color(n.color || "#b8cac7"));
      atmospheres.setColorAt(i, new THREE.Color(n.color || "#b8cac7"));
    });
    nodes.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    nodes.computeBoundingSphere();
    scene.add(nodes);
    scene.add(atmospheres);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.46, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf1f3da,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    const selectedPosition = positions.get(selected);
    if (selectedPosition) {
      ring.position.set(
        selectedPosition.x,
        selectedPosition.y,
        selectedPosition.z,
      );
      scene.add(ring);
    }
    const vertices = [],
      colors = [];
    for (const route of routes) {
      const color = new THREE.Color(route.color || "#9fbab9");
      for (let i = 1; i < route.points.length; i++) {
        for (const p of [route.points[i - 1], route.points[i]]) {
          vertices.push(p.x, p.y, p.z);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
    const lines = new THREE.BufferGeometry();
    lines.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    lines.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    scene.add(
      new THREE.LineSegments(
        lines,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: active ? 0.85 : selected ? 0.5 : 0.28,
        }),
      ),
    );
    if (active && active.source !== active.target && routes[0]) {
      const points = routes[0].points,
        last = points.at(-1),
        previous = points.at(-2);
      const end = new THREE.Vector3(last.x, last.y, last.z);
      const direction = end
        .clone()
        .sub(new THREE.Vector3(previous.x, previous.y, previous.z))
        .normalize();
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 6, 10),
        new THREE.MeshBasicMaterial({ color: active.color }),
      );
      arrow.position.copy(end).addScaledVector(direction, -19);
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      );
      scene.add(arrow);
    }
    const bounds = new THREE.Box3();
    for (const node of graph.nodes) {
      const p = positions.get(node.id);
      bounds.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
    }
    for (const route of routes)
      for (const p of route.points)
        bounds.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
    if (bounds.isEmpty())
      bounds.set(
        new THREE.Vector3(-50, -50, -20),
        new THREE.Vector3(50, 50, 20),
      );
    const center = bounds.getCenter(new THREE.Vector3()),
      extent = bounds.getSize(new THREE.Vector3());
    const viewingDirection = new THREE.Vector3(
      0.12,
      active ? 0.15 : 0.55,
      1,
    ).normalize();
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), viewingDirection)
      .normalize();
    const up = new THREE.Vector3()
      .crossVectors(viewingDirection, right)
      .normalize();
    const framePoints = [
      ...graph.nodes.map((node) => positions.get(node.id)),
      ...routes.flatMap((route) => route.points),
    ];
    const frameRange = (axis) => {
      let min = Infinity,
        max = -Infinity;
      for (const p of framePoints) {
        const coordinate = axis.x * p.x + axis.y * p.y + axis.z * p.z;
        min = Math.min(min, coordinate);
        max = Math.max(max, coordinate);
      }
      return framePoints.length ? [min, max] : [-50, 50];
    };
    // Center in the camera plane, rather than the enclosing world-space box.
    for (const axis of [right, up]) {
      const [min, max] = frameRange(axis);
      center.addScaledVector(axis, (min + max) / 2 - center.dot(axis));
    }
    let width = 1,
      height = 1,
      frame = 0,
      pending = 0,
      disposed = false,
      projectedNodes = [],
      projectedRoutes = [];
    let saved = null;
    try {
      saved = readSpatialCamera(sessionStorage.getItem(cacheKey));
    } catch {
      /* Storage is optional. */
    }
    const project = (p) => {
      const v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      return {
        x: ((v.x + 1) * width) / 2,
        y: ((1 - v.y) * height) / 2,
        visible: v.z >= -1 && v.z <= 1,
      };
    };
    const render = () => {
      pending = 0;
      if (disposed || document.hidden) return;
      ring.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      projectedNodes = graph.nodes
        .map((n) => ({
          ...n,
          ...project(positions.get(n.id)),
          radius:
            (bodyUnit / spanPerPixel) *
            (active ? 1 : celestialScale(n.connection_count)) *
            camera.zoom,
        }))
        .filter((n) => n.visible);
      projectedRoutes = routes.map((route) => ({
        id: route.id,
        points: route.points.map(project),
      }));
      const candidates = [...projectedNodes].sort(
        (a, b) =>
          Number(b.id === selected) - Number(a.id === selected) ||
          b.connection_count - a.connection_count ||
          a.id.localeCompare(b.id),
      );
      const selectedLabels = [],
        occupied = [],
        dossiers = new Set();
      const focused = !!selected && graph.nodes.length <= 8;
      const maxLabels = focused ? 8 : width < 560 ? 8 : 18;
      for (const node of candidates) {
        const dossier = node.appearances[0]?.dossier;
        if (!focused && dossiers.has(dossier)) continue;
        const text = node.label.replaceAll("|", " "),
          w = Math.min(170, Math.max(80, text.length * 7.2));
        const h = text.length > 22 ? 40 : 24;
        const x = Math.max(8, Math.min(width - w - 8, node.x - w / 2));
        const bodyPixels =
          (bodyUnit / spanPerPixel) *
          (active ? 1 : celestialScale(node.connection_count));
        const y = node.y + bodyPixels * camera.zoom + 7;
        if (node.x < 8 || node.x > width - 8 || y < 44 || y + h > height - 8)
          continue;
        if (
          occupied.some(
            (r) =>
              x < r.x + r.w + 8 &&
              x + w + 8 > r.x &&
              y < r.y + r.h + 6 &&
              y + h + 6 > r.y,
          )
        )
          continue;
        selectedLabels.push({
          id: node.id,
          text,
          x,
          y,
          w,
          anchorX: node.x,
          anchorY: node.y,
          color: node.color,
        });
        occupied.push({ x, y, w, h });
        dossiers.add(dossier);
        if (selectedLabels.length >= maxLabels) break;
      }
      setLabels(selectedLabels);
      canvas.dataset.renderState = "ready";
      canvas.dataset.frame = String(++frame);
      canvas.dataset.nodeCount = String(graph.nodes.length);
      canvas.dataset.framedNodeCount = String(
        projectedNodes.filter(
          (node) =>
            node.x - node.radius >= 0 &&
            node.x + node.radius <= width &&
            node.y - node.radius >= 0 &&
            node.y + node.radius <= height,
        ).length,
      );
      canvas.dataset.claimCount = String(graph.edges.length);
      canvas.dataset.routeCount = String(routes.length);
      canvas.dataset.appearance = "celestial-v1";
      canvas.dataset.camera = [
        ...camera.position.toArray(),
        ...controls.target.toArray(),
        camera.zoom,
      ]
        .map((v) => v.toFixed(4))
        .join(",");
      callbacks.current.onZoom(camera.zoom);
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            version: 1,
            position: camera.position.toArray(),
            target: controls.target.toArray(),
            zoom: camera.zoom,
          }),
        );
      } catch {
        /* The graph also works without storage. */
      }
    };
    const invalidate = () => {
      if (!pending && !disposed) pending = requestAnimationFrame(render);
    };
    const fit = () => {
      camera.zoom = 1;
      const distance = Math.max(extent.length(), 150) * 2;
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(viewingDirection.clone().multiplyScalar(distance));
      camera.updateProjectionMatrix();
      controls.update();
      invalidate();
    };
    let bodyUnit = 4,
      spanPerPixel = 1;
    const resize = () => {
      width = Math.max(1, element.clientWidth);
      height = Math.max(1, element.clientHeight);
      const aspect = width / height;
      const projectedExtent = (axis) => {
        const [min, max] = frameRange(axis);
        return max - min;
      };
      const span =
        (Math.max(100, projectedExtent(up), projectedExtent(right) / aspect) +
          (active ? 0 : 48)) *
        (active ? 1.5 : 1.18);
      spanPerPixel = span / height;
      camera.left = (-span * aspect) / 2;
      camera.right = (span * aspect) / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      bodyUnit = active
        ? spanPerPixel * Math.min(28, height * 0.11)
        : Math.max(4, spanPerPixel * 3.8);
      graph.nodes.forEach((n, i) => {
        const p = positions.get(n.id);
        const scale =
          bodyUnit * (active ? 1 : celestialScale(n.connection_count));
        transform.position.set(p.x, p.y, p.z);
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        nodes.setMatrixAt(i, transform.matrix);
        transform.scale.setScalar(scale * 1.22);
        transform.updateMatrix();
        atmospheres.setMatrixAt(i, transform.matrix);
        if (n.id === selected) ring.scale.setScalar(scale);
      });
      nodes.instanceMatrix.needsUpdate = true;
      nodes.computeBoundingSphere();
      atmospheres.instanceMatrix.needsUpdate = true;
      atmospheres.computeBoundingSphere();
      callbacks.current.onCapacity(width < 560 ? 1 : 6);
      invalidate();
    };
    const zoom = (factor) => {
      camera.zoom = Math.max(0.25, Math.min(16, camera.zoom * factor));
      camera.updateProjectionMatrix();
      controls.update();
      invalidate();
    };
    const rotate = (theta, phi = 0) => {
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      );
      spherical.theta += theta;
      spherical.phi = Math.max(
        0.2,
        Math.min(Math.PI - 0.2, spherical.phi + phi),
      );
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update();
      invalidate();
    };
    api.current = { fit, zoom, rotate };
    resize();
    fit();
    if (saved) {
      camera.position.fromArray(saved.position);
      controls.target.fromArray(saved.target);
      camera.zoom = saved.zoom;
      camera.updateProjectionMatrix();
      controls.update();
    }
    controls.addEventListener("change", invalidate);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    let down = null;
    const pointerDown = (e) => {
      down = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    };
    const pointerUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
        down = null;
        return;
      }
      down = null;
      const rect = canvas.getBoundingClientRect();
      const hits = nearestSpatialMarks(
        { x: e.clientX - rect.x, y: e.clientY - rect.y },
        projectedNodes,
        projectedRoutes,
        e.pointerType === "touch" ? 22 : 14,
      );
      if (hits.length === 1 && hits[0].kind === "node")
        callbacks.current.onNode(hits[0].id);
      else if (hits.length === 1 && hits[0].kind === "route") {
        const match = routes.find((r) => r.id === hits[0].id);
        if (match.edges.length === 1)
          callbacks.current.onEdge(match.edges[0].id);
        else setChoices(match.edges.map((edge) => ({ kind: "edge", edge })));
      } else if (hits.length) {
        setChoices(
          hits.flatMap((hit) =>
            hit.kind === "node"
              ? [{ kind: "node", node: index.get(hit.id) }]
              : routes
                  .find((r) => r.id === hit.id)
                  .edges.map((edge) => ({ kind: "edge", edge })),
          ),
        );
      } else setChoices(null);
    };
    const keyDown = (event) => {
      const keys = {
        ArrowLeft: [-0.16, 0],
        ArrowRight: [0.16, 0],
        ArrowUp: [0, -0.12],
        ArrowDown: [0, 0.12],
      };
      if (keys[event.key]) {
        event.preventDefault();
        rotate(...keys[event.key]);
      } else if (["+", "=", "-", "Home"].includes(event.key)) {
        event.preventDefault();
        event.key === "Home" ? fit() : zoom(event.key === "-" ? 0.8 : 1.25);
      }
    };
    const lost = (event) => {
      event.preventDefault();
      if (!disposed)
        callbacks.current.onUnavailable(
          "The 3D graphics context was lost. Your selection is preserved in 2D.",
        );
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("keydown", keyDown);
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", invalidate);
    return () => {
      disposed = true;
      cancelAnimationFrame(pending);
      observer.disconnect();
      controls.dispose();
      api.current = null;
      document.removeEventListener("visibilitychange", invalidate);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("webglcontextlost", lost);
      const geometries = new Set([ring.geometry]),
        materials = new Set([ring.material]);
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      nodes.dispose();
      atmospheres.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [graph, positions, routes, selected, active, cacheKey, index]);

  return (
    <div className="ts-scene" ref={host}>
      <div className="ts-labels" aria-label="Visible spatial entities">
        {labels.map((label) => (
          <button
            key={label.id}
            className={label.id === selected ? "selected" : ""}
            style={{
              left: label.x,
              top: label.y,
              width: label.w,
              "--mark-color": label.color,
            }}
            data-node-id={label.id}
            data-anchor-x={label.anchorX}
            data-anchor-y={label.anchorY}
            onClick={() => onNode(label.id)}
            title={label.text}
          >
            {label.text}
          </button>
        ))}
      </div>
      {active ? (
        <div className="ts-assertion">
          <strong>{active.predicate || active.relationship_label}</strong>
          <span>{active.relationship_label}</span>
        </div>
      ) : (
        <div className="ts-tools" aria-label="Spatial controls">
          <Button
            label="Rotate left"
            icon={RotateCcw}
            onClick={() => api.current?.rotate(-0.22)}
          />
          <Button
            label="Rotate right"
            icon={RotateCw}
            onClick={() => api.current?.rotate(0.22)}
          />
          <Button
            label="Group parallel connections"
            icon={Layers}
            aria-pressed={bundled}
            onClick={() => setBundled((v) => !v)}
          />
          {groups.length > 0 && (
            <Button
              label="Inspect grouped connections"
              icon={ListFilter}
              aria-expanded={groupsOpen}
              onClick={() => {
                setGroupsOpen((v) => !v);
                setChoices(null);
              }}
            />
          )}
        </div>
      )}
      {(choices || groupsOpen) && (
        <section
          className="ts-picker"
          aria-label={
            choices ? "Connections at this point" : "Grouped connections"
          }
        >
          <header>
            <strong>
              {choices ? "At this point" : `${groups.length} connection groups`}
            </strong>
            <Button
              label="Close connection picker"
              icon={X}
              onClick={() => {
                setChoices(null);
                setGroupsOpen(false);
              }}
            />
          </header>
          {choices
            ? choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() =>
                    choice.kind === "node"
                      ? onNode(choice.node.id)
                      : onEdge(choice.edge.id)
                  }
                >
                  {choice.kind === "node" ? (
                    choice.node.label
                  ) : (
                    <>
                      <span>{choice.edge.relationship_label}</span>
                      {choice.edge.text}
                    </>
                  )}
                </button>
              ))
            : groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setChoices(
                      group.edges.map((edge) => ({ kind: "edge", edge })),
                    );
                    setGroupsOpen(false);
                  }}
                >
                  <span>{group.edges.length} sourced connections</span>
                  {index.get(group.edges[0].source)?.label} /{" "}
                  {index.get(group.edges[0].target)?.label}
                </button>
              ))}
        </section>
      )}
    </div>
  );
});
