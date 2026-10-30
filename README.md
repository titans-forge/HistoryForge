# History Forge

An evidence-bound historical connection explorer, rendered as a living celestial tapestry.

**[Open the public edition](https://titans-forge.github.io/HistoryForge/)**

## Public Pilot

This release is deliberately smaller than the private History Forge research workspace:

- 95 source-bound signature-list connections across the Declaration of Independence and U.S. Constitution.
- 91 entity records: 89 person records and two documents, with six explicitly supported cross-document identity mappings.
- Celestial 3D overview, accessible 2D alternative, search, focus neighborhoods and a browsable connection list.
- Exact cited signature excerpts, source and corpus hashes, date qualifications, and JSON/Markdown evidence exports.

An edge means **listed signature**, not friendship, personal contact or co-authorship.
July 4, 1776 is the Declaration's adoption date, not an individual signing date assigned to every signer.
Spatial distance is schematic. Body area reflects recorded connection count within this pilot, not historical importance or confidence.

The two lists are from official National Archives transcriptions. Six identity links use the transcription's own links to NARA biographical entries; these later accounts are not independent primary witnesses. Other source labels and abbreviations are preserved. William Jackson's secretary attestation is not counted among the Constitution's 39 delegate signatures.

## Run Locally

Requires Node.js 22 and Python 3 (standard library only for deterministic data generation).

```sh
npm ci
npm test
npm run build
npm run preview -- --port 5278
```

Open `http://127.0.0.1:5278/HistoryForge/`. The project intentionally uses the same nested base path as GitHub Pages.
No Python web service, API key, account, model call or database is required. Three.js/WebGL provides optional 3D; the 2D view preserves access when WebGL is unavailable.

## Evidence And Rights

Original code, structured data and annotations: **Apache-2.0**. Historical signature text: separate public-domain status. Dependencies retain their own licenses. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

`public/data/source-inputs.json` records exact signature blocks, explicit identity mappings, source URLs and capture hashes. `scripts/build_collection.py` regenerates all three data payloads without network access. Corpus hashes use canonical JSON excluding `audit`; graph revision excludes `revision`.

Full raw HTML captures remain in the private release evidence folder, not in this repository. The public edition contains no modern NARA photographs, document images, biographies, private-use sources, raw research archive, notebooks, credentials, provider tools or research automation. Attribution does not imply National Archives endorsement.

See [RELEASE_REVIEW.md](RELEASE_REVIEW.md) for the exact reviewed release scope and limitations. Independent AI-assisted checks do not replace institutional historical certification or legal advice.

## Deployment

The Pages workflow runs deterministic tests and builds static assets before deploying. Only `dist/` is deployed. GitHub Pages is configured for GitHub Actions, with no external hosting or paid service required.

Future source packs must pass independent textual and rights/identity review, including actual app and export checks, before admission. The private working corpus is not a publication queue and must not be copied wholesale into this project.
