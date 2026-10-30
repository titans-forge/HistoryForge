# Release Review

**Status: bounded local release review passed; public hosting not yet verified.**

Two independent AI-assisted source reviewers inspected the original frozen
transcriptions. They checked the 95 narrow signature-list claims, and both
identified a broken upstream Robert Morris biography fragment. The original
href is now retained alongside the corrected heading locator in the candidate.
Both reviewers accepted that correction and independently examined actual app
and export artifacts. A subsequent textual review found that exported evidence
links escaped the GitHub Pages path. Both reviewers independently checked the
corrected graph revision and exports and accepted their bounded intersections.
Earlier captures, candidate versions, findings and reports remain in the
private release evidence directory.

The current candidate has 91 entity records and 95 connections. Its graph
revision is `97adde06a5984d92696a029f96399e58199a60ff03ea14e815f24160f1d0bd90`;
the SHA-256 of `public/data/source-inputs.json` is
`50cee2906447832b597b81024a3bd6174292da60137a9e6875dd8e3738059341`.
These are records, not a claim that every label identifies a unique historical
person. Dates on connections are document dates, not individual signing dates.

Local verification passed 14 automated tests and a Chromium desktop/mobile
matrix covering nonblank 3D rendering, orbit, 2D fallback, both dossier
excerpts, and actual JSON and Markdown downloads. The public distribution
includes Apache-2.0 and third-party dependency notices. These checks do not
replace legal advice, physical-device testing, or a deployed-site check.
