import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Download, ExternalLink, Network } from "lucide-react";
import TapestryStudio from "./components/TapestryStudio.jsx";
import SourceNotices from "./components/SourceNotices.jsx";
import { request, base } from "./api.js";
import { tapestryReturnHref } from "./tapestryLinks.js";
import { evidenceRecord, evidenceMarkdown, download } from "./exports.js";
import "./public.css";

const home = base + "?tapestry=1&tapestry_v2=1&space=3d";
const github = "https://github.com/titans-forge/HistoryForge";

function Evidence() {
  const [record, setRecord] = useState(null),
    [error, setError] = useState("");
  const params = new URLSearchParams(location.search);
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      if (["dossier", "claim"].some((key) => params.getAll(key).length !== 1))
        throw new Error("Select one public evidence record.");
      const data = await request("/api/tapestry", undefined, abort.signal);
      const edge = data.edges.find(
        (item) =>
          item.dossier === params.get("dossier") &&
          item.claim_id === params.get("claim"),
      );
      if (!edge)
        throw new Error("That connection is not in this public release.");
      const corpus = await request(
        "/api/corpus?" + new URLSearchParams({ dossier: edge.dossier }),
        undefined,
        abort.signal,
      );
      setRecord(evidenceRecord(edge, corpus));
    })().catch((failure) => {
      if (failure.name !== "AbortError") setError(failure.message);
    });
    return () => abort.abort();
  }, []);
  return (
    <main className="public-page">
      <a className="back" href={tapestryReturnHref(location.search) || home}>
        <ArrowLeft size={18} />
        Return to tapestry
      </a>
      <p className="eyebrow">History Forge / Public Evidence</p>
      <h1>{record?.relationship.text || "Evidence record"}</h1>
      {error && <p role="alert">{error}</p>}
      {!record && !error && <p role="status">Loading source evidence</p>}
      {record && (
        <>
          <div className="export-actions">
            <button
              onClick={() =>
                download(
                  JSON.stringify(record, null, 2) + "\n",
                  "application/json",
                  record.claim.id + ".json",
                )
              }
            >
              <Download size={17} />
              JSON
            </button>
            <button
              onClick={() =>
                download(
                  evidenceMarkdown(record),
                  "text/markdown",
                  record.claim.id + ".md",
                )
              }
            >
              <Download size={17} />
              Markdown
            </button>
          </div>
          <dl>
            <dt>Relationship</dt>
            <dd>{record.relationship.relationship_label}</dd>
            <dt>Date</dt>
            <dd>{record.relationship.date_label}</dd>
            <dt>Date basis</dt>
            <dd>{record.relationship.date_basis}</dd>
            <dt>Status</dt>
            <dd>{record.relationship.status}</dd>
          </dl>
          <p className="qualification">{record.qualification}</p>
          <SourceNotices sources={[...new Map(record.evidence.map(({ source }) => [source.id, source])).values()]} />
          {record.evidence.map(({ passage, source }) => (
            <section key={passage.id}>
              <h2>{source.title}</h2>
              <p>{source.kind}</p>
              <p>{passage.citation}</p>
              <blockquote>{passage.text}</blockquote>
              <p>{passage.editorial_context}</p>
              <p>{source.provenance_credit}</p>
              <p>{source.dependence}</p>
              <p>{passage.license_credit}</p>
              <a href={passage.url} target="_blank" rel="noreferrer">
                {source.link_label || "National Archives transcription"} <ExternalLink size={15} />
              </a>
              <details>
                <summary>Source binding</summary>
                <p>
                  Passage SHA-256: <code>{passage.text_sha256}</code>
                </p>
                <p>
                  Corpus SHA-256: <code>{record.audit.corpus_sha256}</code>
                </p>
                <p>{source.perspective}</p>
              </details>
            </section>
          ))}
          {!!record.identity_evidence.length && (
            <section>
              <h2>Identity evidence</h2>
              {record.identity_evidence.map((item) => (
                item.statement ? <p key={item.person_id}>{item.label}: {item.statement} <a href={item.url}>{item.citation}</a></p> : <p key={item.signature}>
                  {item.signature} is mapped to {item.label} using the
                  transcription and <a href={item.url}>{item.heading}</a>. This
                  is a later biographical identification, not an additional
                  primary-source relationship.
                  {item.transcription_href && (
                    <>
                      <br />
                      {item.locator_note}{" "}
                      <a href={item.transcription_href}>
                        Original transcription href
                      </a>
                    </>
                  )}
                </p>
              ))}
            </section>
          )}
          <p>
            {record.scope}{" "}
            <a href={base + "?release=1"}>Release scope and rights</a>
          </p>
        </>
      )}
    </main>
  );
}

function Release() {
  return (
    <main className="public-page">
      <a className="back" href={home}>
        <ArrowLeft size={18} />
        Living Tapestry
      </a>
      <p className="eyebrow">History Forge / Public Release Candidate</p>
      <h1>Rome and the American Founding</h1>
      <p>
        This bounded public edition contains five source-bound claims concerning reported Roman negotiations
        and 95 signature-list connections to two
        historical documents. It is not the full History Forge research corpus.
        Six source-supported identity mappings connect the two lists; other
        labels retain their source spelling or abbreviation.
      </p>
      <h2>What The Connections Mean</h2>
      <p>
        The Roman episode follows Caesar's Civil War I.8-9: reported messages,
        delivery requests and a proposed disbandment in 49 BCE. Caesar is a
        participant and partisan narrator, not an independent witness to his
        opponents' intentions. A proposal is not an agreement or an outcome.
        The young Lucius Caesar and Roscius remain distinct source-local records.
      </p>
      <p>
        Each American edge records a name listed in a National Archives transcription. It
        does not imply a meeting, co-authorship, friendship, approval of every
        provision, or an individual signing date of July 4, 1776. William
        Jackson's attestation is not included among the 39 Constitution delegate
        signatures.
      </p>
      <p>
        The Declaration was adopted July 4, 1776; the Constitution is dated
        September 17, 1787. Regional context is not a claim about nationality or
        birthplace. Body size reflects recorded connections in this pilot, not
        importance or confidence. Spatial distance and surface texture are
        illustrative.
      </p>
      <h2>Source And Rights Scope</h2>
      <p>
        Historical signature text and three identified paragraphs of an old
        Caesar translation are reproduced, not modern photographs, seals, portraits, interpretive
        essays or full website captures. Frozen raw captures remain outside this
        repository; their SHA-256 hashes and exact source URLs are in the public
        source manifest.
      </p>
      <p>
        Original application code and the Forge-owned data already released in
        this preview are licensed under Apache-2.0. Future designated editorial
        data may use the History Forge Data License 1.0; commercial agent
        training on that material requires a separate agreement. Historical
        signature text is public domain. The
        MacDevitt translation (Everyman no. 702, edition first published 1915,
        reprinted 1923 and 1929) is listed as public domain in the USA; its
        Project Gutenberg reuse notice and full terms accompany displayed and
        exported excerpts. This is not worldwide rights clearance;
        third-party libraries retain their licenses. National Archives credit is
        attribution, not endorsement.
      </p>
      <p>
        <a href="https://www.archives.gov/global-pages/privacy.html">
          National Archives use and copyright policy
        </a>
      </p>
      <h2>Research Boundaries</h2>
      <p>
        Source and identity/rights reviews are independent AI-assisted checks,
        not institutional certification or legal advice. Review acceptance is
        restricted to the frozen release candidate. Drafts, notebooks,
        private-use sources, research automation and the Python backend are not
        published. This edition makes no model calls and has no
        application-controlled analytics. GitHub receives normal hosting
        requests; shared URLs may include your selection.
      </p>
      <p>
          <a href={base + "legal/LICENSE"}>Apache-2.0 license</a> /{" "}
          <a href={base + "legal/HISTORY_FORGE_DATA_LICENSE.md"}>Data license</a> /{" "}
          <a href={base + "legal/LICENSING.md"}>License scope</a> /{" "}
        <a href={base + "legal/NOTICE"}>Notices</a> /{" "}
        <a href={base + "legal/dependencies.txt"}>Dependency licenses</a>
      </p>
      <div className="export-actions">
        <a href={base + "data/tapestry.json"}>
          <Download size={17} />
          Graph data
        </a>
        <a href={base + "data/source-inputs.json"}>
          <Download size={17} />
          Source manifest
        </a>
        <a href={github}>
          <Network size={17} />
          GitHub
        </a>
      </div>
    </main>
  );
}

function App() {
  const params = new URLSearchParams(location.search);
  if (params.has("release")) return <Release />;
  if (params.has("claim") || params.has("dossier")) return <Evidence />;
  if (params.size === 0) {
    params.set("space", "3d");
    params.set("tapestry_v2", "1");
    history.replaceState(null, "", base + "?" + params);
  }
  return <TapestryStudio />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
