import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Focus,
  List,
  LoaderCircle,
  Minus,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { request, base } from "../api";
import { layoutTapestry, searchEntities, visibleTapestry } from "../tapestry";
import { tapestryHref, tapestryEvidenceHref } from "../tapestryLinks";
import {
  readFocusState,
  focusNeighborhood,
  bindTapestryEvidence,
} from "../tapestryFocus";
import TapestryCanvas from "./TapestryCanvas";
import SourceNotices from "./SourceNotices";
import TapestryFocusGraph, { EntityGlyph } from "./TapestryFocusGraph";
import "../tapestryFocus.css";
import { spatialPositions } from "../tapestrySpatial.js";
import { evidenceLabel } from "../evidenceLabels.js";

const TapestrySpatial = lazy(() => import("./TapestrySpatial"));

class SpatialBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable(
      "The 3D view could not load. Your selection is preserved in 2D.",
    );
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Tool({ label, icon: Icon, onClick, ...props }) {
  return (
    <button
      className="tf-tool"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}

function InlinePassages({ edge }) {
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");
    request(
      "/api/corpus?" + new URLSearchParams({ dossier: edge.dossier }),
      undefined,
      controller.signal,
    )
      .then((corpus) => {
        if (!controller.signal.aborted)
          setResult(bindTapestryEvidence(edge, corpus));
      })
      .catch((failure) => {
        if (failure.name !== "AbortError" && !controller.signal.aborted)
          setError(failure.message);
      });
    return () => controller.abort();
  }, [edge.id, edge.corpus_sha256, retry]);
  if (error)
    return (
      <div className="tf-evidence-error" role="alert">
        <p>{error}</p>
        <button onClick={() => setRetry((n) => n + 1)}>
          <RotateCcw size={16} />
          Retry evidence
        </button>
      </div>
    );
  if (!result)
    return (
      <p className="tf-loading" role="status">
        <LoaderCircle size={16} />
        Opening cited passages
      </p>
    );
  return (
    <div className="tf-passages">
      <SourceNotices
        sources={[
          ...new Map(
            result.passages.map(({ source }) => [source.id, source]),
          ).values(),
        ]}
      />
      {result.claim.license_scope && (
        <p className="tf-scope">
          {result.claim.license_credit} {evidenceLabel(result.claim.license_scope)}
        </p>
      )}
      {result.passages.map(({ passage: p, source: s }) => (
        <section
          key={p.id}
          className="tf-passage"
          aria-label={"Passage: " + p.citation}
        >
          <div className="tf-source-kind">
            {s.kind || "Source type not supplied"}
          </div>
          <h4>{s.display_label || s.author || s.title}</h4>
          <p className="tf-credit">{s.provenance_credit || s.title}</p>
          {p.editorial_context && <p>{p.editorial_context}</p>}
          {p.text_scope === "selected_excerpt" && (
            <p>Selected source excerpt</p>
          )}
          <blockquote>{p.text}</blockquote>
          <p className="tf-citation">{p.citation}</p>
          {p.translation_credit && <p>{p.translation_credit}</p>}
          {p.original_text && (
            <details>
              <summary>{p.original_language || "Original"} source text</summary>
              <blockquote lang={p.original_language_code}>
                {p.original_text}
              </blockquote>
            </details>
          )}
          {(p.license_credit || p.license_scope) && (
            <p className="tf-scope">
              {p.license_credit} {evidenceLabel(p.license_scope)}
            </p>
          )}
          <a
            className="tf-source-link"
            href={p.url}
            target="_blank"
            rel="noreferrer"
          >
            Open source <ArrowUpRight size={14} />
          </a>
          <details>
            <summary>Perspective, dependence and reuse</summary>
            <p>{s.perspective || "Source perspective not supplied."}</p>
            <p>{s.dependence || "Source dependence not established."}</p>
            <p>{s.rights || "Reuse scope not supplied."}</p>
            <p className="tf-hash">Passage SHA-256: {p.text_sha256}</p>
          </details>
        </section>
      ))}
    </div>
  );
}

export default function TapestryStudio() {
  const [data, setData] = useState(null),
    [scene, setScene] = useState(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const [state, setState] = useState(
      () => readFocusState(location.search).state,
    ),
    [notice, setNotice] = useState("");
  const [panelOpen, setPanelOpen] = useState(
      () => !!readFocusState(location.search).state.node || matchMedia("(min-width: 761px)").matches,
    ),
    [passagesOpen, setPassagesOpen] = useState(false);
  const [limit, setLimit] = useState(24),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(6),
    [zoomLevel, setZoomLevel] = useState(1);
  const search = useRef(null),
    camera = useRef(null),
    panel = useRef(null),
    browse = useRef(null);
  useEffect(() => {
    document.title = "History Forge | Living Tapestry";
    const controller = new AbortController();
    setError("");
    setData(null);
    setScene(null);
    request("/api/tapestry", undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const checked = readFocusState(location.search, result);
        const graph = layoutTapestry(result);
        setData(result);
        setScene(graph);
        setState(checked.state);
        setNotice(checked.notice);
        setPanelOpen(!!(checked.state.node || checked.state.query) || matchMedia("(min-width: 761px)").matches);
        history.replaceState(null, "", tapestryHref(checked.state));
      })
      .catch((failure) => {
        if (failure.name !== "AbortError") setError(failure.message);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const restore = () => {
      const next = readFocusState(location.search, data);
      setState(next.state);
      setNotice(next.notice);
      setPanelOpen(!!(next.state.node || next.state.query));
    };
    addEventListener("popstate", restore);
    return () => removeEventListener("popstate", restore);
  }, [data]);
  useEffect(() => {
    setLimit(24);
    setPage(0);
    setPassagesOpen(false);
    panel.current?.scrollTo(0, 0);
  }, [state.node, state.edge, state.region, state.relation, state.query]);
  useEffect(() => {
    setPage(0);
  }, [pageSize]);
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        browse.current?.focus();
      }
    };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, []);
  const visible = useMemo(
    () => (scene ? visibleTapestry(scene, state.region, state.relation) : null),
    [scene, state.region, state.relation],
  );
  const spatial = useMemo(
    () => (scene && state.space === "3d" ? spatialPositions(scene) : null),
    [scene, state.space],
  );
  const active = visible?.edges.find((e) => e.id === state.edge),
    node = visible?.nodes.find((n) => n.id === state.node);
  const connections = useMemo(
    () =>
      visible?.edges.filter(
        (e) => e.source === state.node || e.target === state.node,
      ) || [],
    [visible, state.node],
  );
  const neighborhood = useMemo(
    () =>
      visible
        ? focusNeighborhood(visible, state.node, state.edge, page, pageSize)
        : null,
    [visible, state.node, state.edge, page, pageSize],
  );
  const matches = useMemo(
    () => (visible ? searchEntities(visible.nodes, state.query) : []),
    [visible, state.query],
  );
  const relations = useMemo(
    () =>
      data
        ? [
            ...new Map(
              data.edges.map((e) => [
                e.relationship_type,
                e.relationship_label,
              ]),
            ).entries(),
          ].sort((a, b) => a[1].localeCompare(b[1]))
        : [],
    [data],
  );
  function navigate(patch, replace = false) {
    const next = readFocusState(
      tapestryHref({ ...state, ...patch }).split("?")[1],
      data,
    );
    setState(next.state);
    setNotice(next.notice);
    history[replace ? "replaceState" : "pushState"](
      null,
      "",
      tapestryHref(next.state),
    );
  }
  const sharedEntities = useMemo(
    () => visible?.nodes.filter((entity) =>
      entity.identity_status === "confirmed_mapping" &&
      new Set(entity.appearances.map((appearance) => appearance.dossier)).size > 1
    ).sort((a, b) => a.label.localeCompare(b.label)) || [],
    [visible],
  );
  function chooseNode(id) {
    navigate({ node: id, edge: "", lens: "focus" });
    setPanelOpen(true);
  }
  function chooseEdge(id) {
    const edge = visible.edges.find((e) => e.id === id);
    if (!edge) return;
    navigate({
      node: [edge.source, edge.target].includes(state.node)
        ? state.node
        : edge.source,
      edge: id,
      lens: "focus",
    });
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    browse.current?.focus();
  }
  const focused = state.lens === "focus" && !!node;
  const is3d = state.space === "3d";
  function spatialUnavailable(message) {
    navigate({ space: "2d" }, true);
    setNotice(message);
  }
  return (
    <div className={"tf-shell " + (panelOpen ? "tf-panel-open" : "")}>
      <header className="tf-nav">
        <a href={base + "?tapestry_v2=1&space=3d"} className="tf-brand">
          <Network size={23} />
          <span>History Forge</span>
        </a>
        <h1>
          Living Tapestry <span>II</span>
        </h1>
        <nav aria-label="Collection views">
          <a href={base + "?release=1"}>Public edition</a>
          <a href="https://github.com/titans-forge/HistoryForge">GitHub</a>
        </nav>
      </header>
      <p className="public-scope">
        Public episodes / Rome and the American Founding / not the full research
        corpus
      </p>
      <div className="tf-toolbar">
        <label className="tf-search">
          <Search size={17} />
          <input
            ref={search}
            aria-label="Find a person or entity"
            placeholder="Find a person or entity"
            value={state.query}
            maxLength={160}
            onFocus={() => state.query && setPanelOpen(true)}
            onChange={(e) => {
              navigate(
                { query: e.target.value, node: "", edge: "", lens: "overview" },
                true,
              );
              setPanelOpen(true);
            }}
          />
          {state.query && (
            <Tool
              label="Clear search"
              icon={X}
              onClick={() => {
                navigate({ query: "" }, true);
                search.current.focus();
              }}
            />
          )}
        </label>
        <div className="tf-mode" aria-label="Network view">
          <button
            aria-pressed={!focused}
            aria-label="Overview"
            title="Overview"
            onClick={() => navigate({ lens: "overview" })}
          >
            <Network size={16} />
            <span>Overview</span>
          </button>
          <button
            aria-pressed={focused}
            aria-label="Focus"
            title="Focus"
            disabled={!node}
            onClick={() => navigate({ lens: "focus" })}
          >
            <Focus size={16} />
            <span>Focus</span>
          </button>
        </div>
        <div className="tf-renderer" aria-label="Network dimensions">
          <button
            aria-pressed={!is3d}
            title="Two-dimensional network"
            onClick={() => navigate({ space: "2d" })}
          >
            <Square size={15} />
            2D
          </button>
          <button
            aria-pressed={is3d}
            title="Three-dimensional schematic network"
            onClick={() => navigate({ space: "3d" })}
          >
            <Box size={15} />
            3D
          </button>
        </div>
        <div className="tf-counts" aria-live="polite">
          {data ? (
            <>
              <strong>{visible.nodes.length}</strong> entities <span>/</span>{" "}
              <strong>{visible.edges.length}</strong> connections
            </>
          ) : (
            "Loading collection"
          )}
        </div>
        <button
          className="tf-tool"
          ref={browse}
          aria-label={panelOpen ? "Close details" : "Browse entities"}
          title={panelOpen ? "Close details" : "Browse entities"}
          aria-expanded={panelOpen}
          aria-controls="tf-details"
          onClick={() => setPanelOpen((open) => !open)}
        >
          {panelOpen ? (
            <PanelRightClose size={19} />
          ) : (
            <PanelRightOpen size={19} />
          )}
        </button>
      </div>
      {data && (
        <div className="tf-filterbar">
          <div className="tf-regions" aria-label="Regional context filters">
            <button
              aria-pressed={state.region === "all"}
              onClick={() => navigate({ region: "all" })}
            >
              All regions
            </button>
            {data.regions
              .filter((r) => data.edges.some((e) => e.region === r.id))
              .map((r) => (
                <button
                  key={r.id}
                  aria-pressed={state.region === r.id}
                  onClick={() =>
                    navigate({ region: state.region === r.id ? "all" : r.id })
                  }
                  title={r.label + ": dossier context, not nationality"}
                >
                  <i style={{ background: r.color }} />
                  {r.label}
                </button>
              ))}
          </div>
          <details className="tf-filters">
            <summary aria-label="Relationships" title="Relationships">
              <SlidersHorizontal size={16} />
              <span>Relationships</span>
              {state.relation !== "all" && <Check size={13} />}
            </summary>
            <label>
              Relationship type
              <select
                aria-label="Filter relationship type"
                value={state.relation}
                onChange={(e) => navigate({ relation: e.target.value })}
              >
                <option value="all">All relationship types</option>
                {relations.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </details>
        </div>
      )}
      {notice && (
        <div className="tf-notice" role="status">
          {notice}
          <Tool label="Dismiss notice" icon={X} onClick={() => setNotice("")} />
        </div>
      )}
      <main className="tf-workspace">
        <section className="tf-stage" aria-label="Sourced historical network">
          {error ? (
            <div className="tf-empty" role="alert">
              <h2>Tapestry unavailable</h2>
              <p>{error}</p>
              <button onClick={() => setReload((n) => n + 1)}>
                <RotateCcw size={16} />
                Retry
              </button>
            </div>
          ) : !scene ? (
            <div className="tf-empty" role="status">
              <LoaderCircle size={24} />
              <p>Gathering the collection</p>
            </div>
          ) : (
            <>
              <div className="tf-context">
                <div className="tf-context-top">
                  <span>
                    {focused
                      ? active
                        ? "Selected connection"
                        : "Direct connections"
                      : "Connected collection"}
                  </span>
                  {focused && (
                    <button onClick={() => navigate({ lens: "overview" })}>
                      <ArrowLeft size={13} />
                      Collection
                    </button>
                  )}
                </div>
                <h2>
                  {focused
                    ? active
                      ? active.dossier_title
                      : node.label.replaceAll("|", " ")
                    : "Rome and the American Founding"}
                </h2>
                <p>
                  {focused
                    ? active
                      ? (active.date_precision === "document_date_only" ? "Document date / " : "") + active.date_label
                      : `${connections.length} sourced connections`
                    : `${data.counts.dossiers} source packs / ${data.counts.entities} public entity records`}
                </p>
              </div>
              <div className="tf-graph-surface">
                {is3d ? (
                  <SpatialBoundary onUnavailable={spatialUnavailable}>
                    <Suspense
                      fallback={
                        <div className="tf-empty" role="status">
                          <LoaderCircle size={24} />
                          <p>Opening spatial network</p>
                        </div>
                      }
                    >
                      <TapestrySpatial
                        ref={camera}
                        graph={focused ? neighborhood : visible}
                        positions={spatial}
                        selected={state.node}
                        activeEdge={focused ? state.edge : ""}
                        cacheKey={
                          "hf-tapestry-spatial-v1-" +
                          JSON.stringify([
                            data.revision,
                            state.region,
                            state.relation,
                            state.lens,
                            state.node,
                            focused ? state.edge : "",
                            page,
                            pageSize,
                          ])
                        }
                        onNode={chooseNode}
                        onEdge={chooseEdge}
                        onUnavailable={spatialUnavailable}
                        onZoom={setZoomLevel}
                        onCapacity={setPageSize}
                      />
                    </Suspense>
                  </SpatialBoundary>
                ) : focused ? (
                  <TapestryFocusGraph
                    graph={neighborhood}
                    selected={state.node}
                    activeEdge={state.edge}
                    onNode={chooseNode}
                    onEdge={chooseEdge}
                    onCapacity={setPageSize}
                  />
                ) : (
                  <TapestryCanvas
                    key={data.revision + state.region + state.relation}
                    ref={camera}
                    scene={visible}
                    selected={state.node}
                    activeEdge={state.edge}
                    revision={data.revision}
                    onNode={chooseNode}
                    onEdge={chooseEdge}
                    onZoom={setZoomLevel}
                    enhanced
                    cameraKey={
                      "hf-tapestry-v2-camera-" +
                      state.region +
                      "-" +
                      state.relation
                    }
                  />
                )}
              </div>
              {!visible.edges.length && (
                <div className="tf-empty">
                  <h2>No connections match</h2>
                  <button
                    onClick={() => navigate({ region: "all", relation: "all" })}
                  >
                    <RotateCcw size={16} />
                    Reset filters
                  </button>
                </div>
              )}
              <div
                className={
                  "tf-stage-bottom" +
                  (is3d && focused ? " tf-spatial-bottom" : "")
                }
              >
                {focused && !is3d ? (
                  <div className="tf-local-count">
                    <span>
                      {neighborhood.nodes.length} entities <span>/</span>{" "}
                      {neighborhood.edges.length} connections
                    </span>
                    {!active && neighborhood.pages > 1 && (
                      <div className="tf-pagination">
                        <Tool
                          label="Previous neighbors"
                          icon={ChevronLeft}
                          disabled={!neighborhood.page}
                          onClick={() => setPage((n) => n - 1)}
                        />
                        <output>
                          {neighborhood.page + 1} / {neighborhood.pages}
                        </output>
                        <Tool
                          label="Next neighbors"
                          icon={ChevronRight}
                          disabled={
                            neighborhood.page === neighborhood.pages - 1
                          }
                          onClick={() => setPage((n) => n + 1)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="tf-zoom">
                    <Tool
                      label="Zoom out"
                      icon={Minus}
                      onClick={() => camera.current?.zoom(0.8)}
                    />
                    <output aria-label="Zoom level">
                      {Math.round(zoomLevel * 100)}%
                    </output>
                    <Tool
                      label="Zoom in"
                      icon={Plus}
                      onClick={() => camera.current?.zoom(1.25)}
                    />
                    <Tool
                      label="Fit network"
                      icon={Focus}
                      onClick={() => camera.current?.fit()}
                    />
                  </div>
                )}
                {is3d && focused && !active && neighborhood.pages > 1 && (
                  <div className="tf-pagination">
                    <Tool
                      label="Previous neighbors"
                      icon={ChevronLeft}
                      disabled={!neighborhood.page}
                      onClick={() => setPage((n) => n - 1)}
                    />
                    <output>
                      {neighborhood.page + 1} / {neighborhood.pages}
                    </output>
                    <Tool
                      label="Next neighbors"
                      icon={ChevronRight}
                      disabled={neighborhood.page === neighborhood.pages - 1}
                      onClick={() => setPage((n) => n + 1)}
                    />
                  </div>
                )}
                <button
                  className="tf-list-toggle"
                  onClick={() => setPanelOpen(true)}
                  title="Browse connections"
                >
                  <List size={17} />
                  <span>{node ? "Connections" : "Entities"}</span>
                </button>
              </div>
            </>
          )}
        </section>
        {scene && (
          <aside
            id="tf-details"
            className="tf-rail"
            aria-label="Tapestry details"
            hidden={!panelOpen}
            ref={panel}
          >
            <div className="tf-rail-head">
              <h2>
                {active
                  ? "Connection & evidence"
                  : node
                    ? "Entity connections"
                    : state.query
                      ? "Search results"
                      : "Entities"}
              </h2>
              <Tool
                label="Close evidence panel"
                icon={X}
                onClick={closePanel}
              />
            </div>
            {active ? (
              <div className="tf-evidence">
                <button
                  className="tf-back"
                  onClick={() => navigate({ edge: "" })}
                >
                  <ChevronLeft size={14} />
                  Entity connections
                </button>
                <div className="tf-endpoints">
                  {[active.source, active.target].map((id, i) => (
                    <span key={i}>
                      {i === 1 && <ArrowRight size={15} />}
                      <button onClick={() => chooseNode(id)}>
                        {scene.index.get(id).label.replaceAll("|", " ")}
                        {active.provisional_endpoints?.includes(
                          i ? "object" : "subject",
                        ) && <small>Provisional source-local</small>}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="tf-relationship">
                  {active.relationship_label}
                </div>
                <div className="tf-date">
                  <strong>{active.date_label || "Date not supplied"}</strong>
                  {active.date_basis && <p>{active.date_basis}</p>}
                </div>
                <h3>{active.text}</h3>
                <button
                  className="tf-read"
                  aria-expanded={passagesOpen}
                  aria-controls="tf-inline-passages"
                  onClick={() => setPassagesOpen((open) => !open)}
                >
                  <BookOpen size={17} />
                  {passagesOpen ? "Close passages" : "Read cited passages"}
                  <span>{active.citations.length}</span>
                </button>
                {passagesOpen && (
                  <div id="tf-inline-passages">
                    <InlinePassages key={active.id} edge={active} />
                  </div>
                )}
                {active.note && active.note !== active.date_basis && (
                  <p className="tf-qualification">{active.note}</p>
                )}
                <a
                  className="tf-dossier-link"
                  href={tapestryEvidenceHref(active, state)}
                >
                  Open evidence record <ArrowUpRight size={15} />
                </a>
                <details className="tf-review" open>
                  <summary>Sources and review</summary>
                  {active.citations.map((c) => (
                    <p key={c.passage_id}>
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {c.source}
                        <ArrowUpRight size={12} />
                      </a>
                      <span>{c.citation}</span>
                      {c.external_locator_kind && (
                        <span>
                          {c.external_locator_kind.replaceAll("_", " ")}
                        </span>
                      )}
                      {c.license_scope && <span>{evidenceLabel(c.license_scope)}</span>}
                    </p>
                  ))}
                  <p>{active.review}</p>
                </details>
              </div>
            ) : node ? (
              <div className="tf-entity">
                <button
                  className="tf-back"
                  onClick={() =>
                    navigate({ node: "", edge: "", lens: "overview" })
                  }
                >
                  <ChevronLeft size={14} />
                  All entities
                </button>
                <div className="tf-entity-heading">
                  <span style={{ color: node.color }}>
                    <EntityGlyph type={node.type} size={25} />
                  </span>
                  <h3>{node.label.replaceAll("|", " ")}</h3>
                </div>
                <p className="tf-identity">
                  {node.type.replaceAll("_", " ")} /{" "}
                  {node.identity_status === "confirmed_mapping"
                    ? "Shared identity"
                    : "Dossier-local record"}
                </p>
                <details className="tf-appearances">
                  <summary>
                    {node.appearances.length} dossier appearance
                    {node.appearances.length !== 1 ? "s" : ""}
                  </summary>
                  {node.appearances.map((a) => (
                    <p key={a.dossier + a.node_id}>
                      {a.title}
                      <small>{a.period}</small>
                    </p>
                  ))}
                </details>
                <h4>{connections.length} sourced connections</h4>
                <ul className="tf-connections">
                  {connections.slice(0, limit).map((e) => (
                    <li key={e.id}>
                      <button onClick={() => chooseEdge(e.id)}>
                        <span className="tf-relation-label">
                          {e.relationship_label}
                          <ArrowRight size={14} />
                        </span>
                        <strong>{e.text}</strong>
                        <small>{e.date_precision === "document_date_only" ? "Document date / " : ""}{e.date_label}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                {connections.length > limit && (
                  <button
                    className="tf-more"
                    onClick={() => setLimit((n) => n + 24)}
                  >
                    More connections
                  </button>
                )}
              </div>
            ) : (
              <div className="tf-entities">
                {!state.query && (
                  <section className="public-shared" aria-label="Historical episodes">
                    <h3>Historical episodes</h3>
                    <ul>{data.dossiers.map((dossier) => {
                      const entry = scene.nodes.find((item) => item.appearances.some((a) => a.dossier === dossier.id) && item.type === "document") ||
                        scene.nodes.filter((item) => item.appearances.some((a) => a.dossier === dossier.id)).sort((a, b) => b.connection_count - a.connection_count || a.id.localeCompare(b.id))[0];
                      return entry && <li key={dossier.id}><button onClick={() => {
                        navigate({ node: entry.id, edge: "", lens: "focus", region: "all", relation: "all", query: "" });
                        setPanelOpen(true);
                      }}><span>{dossier.title}<small>{dossier.period}</small></span><ArrowRight size={15} /></button></li>;
                    })}</ul>
                  </section>
                )}
                {!state.query && sharedEntities.length > 0 && (
                  <section className="public-shared" aria-label="Across both documents">
                    <h3>Across both documents</h3>
                    <ul>
                      {sharedEntities.map((entity) => (
                        <li key={entity.id}>
                          <button onClick={() => chooseNode(entity.id)}>
                            <span>{entity.label.replaceAll("|", " ")}</span>
                            <ArrowRight size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <p>
                  {matches.length} {state.query ? "matching" : "visible"}{" "}
                  entities
                </p>
                <ul aria-label="Entity results">
                  {matches.slice(0, limit).map((n) => (
                    <li key={n.id}>
                      <button onClick={() => chooseNode(n.id)}>
                        <EntityGlyph
                          type={n.type}
                          size={19}
                          style={{ color: n.color }}
                        />
                        <span>
                          <strong>{n.label.replaceAll("|", " ")}</strong>
                          <small>
                            {n.type.replaceAll("_", " ")} / {n.connection_count}{" "}
                            recorded connections
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                {!matches.length && <p role="status">No matching entities.</p>}
                {matches.length > limit && (
                  <button
                    className="tf-more"
                    onClick={() => setLimit((n) => n + 24)}
                  >
                    More entities
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </main>
      <footer className="tf-footer">
        <span>Regional context, not nationality</span>
        <span>
          {is3d
            ? focused && active
              ? "Schematic assertion / directional claim"
              : "Depth: hops / body area: recorded connections (capped)"
            : `${focused ? "Schematic connections" : "Schematic layout"} / local collection`}
        </span>
      </footer>
    </div>
  );
}
