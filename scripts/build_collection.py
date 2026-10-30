"""Deterministically build the static pilot from its frozen, reviewed source inputs."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def write(name, value):
    (DATA / name).write_text(json.dumps(value, indent=2, ensure_ascii=True) + '\n')

def build():
    inputs = json.loads((DATA / 'source-inputs.json').read_text())
    captures = {item['file']: item for item in inputs['capture_manifest']}
    mapping = {item['signature']: item for item in inputs['identity_mappings']}
    assert len(mapping) == 6
    nodes, edges, dossiers, revisions = {}, [], [], {}
    shared = {item['label'] for item in mapping.values()}
    for short, year, title, date, context, credit in [
        ('declaration', '1776', 'Declaration of Independence', 'July 4, 1776',
         "Document adoption date, not an individual signing date. This edge records a listed signature only.",
         'National Archives transcription of the Stone engraving of the parchment Declaration.'),
        ('constitution', '1787', 'United States Constitution', 'September 17, 1787',
         "Document date in the Convention subscription clause. This edge records a listed delegate signature, not assent to every provision; William Jackson is excluded as secretary.",
         'National Archives transcription of the parchment Constitution inscribed by Jacob Shallus.'),
    ]:
        dossier = short + '-' + year
        doc_id = 'document-' + dossier
        url = captures[short + '.raw']['url']
        appearance = dict(dossier=dossier, title=title, period=year, region='americas')
        dossiers.append(dict(id=dossier, title=title, period=year, region='americas'))
        def add_node(person_id, label, kind, alias=None):
            if person_id not in nodes:
                nodes[person_id] = dict(id=person_id, label=label, type=kind,
                    identity_status='confirmed_mapping' if label in shared else 'source_bound',
                    aliases=[], appearances=[], regions=['americas'], region='americas')
            item = nodes[person_id]
            if alias and alias != label and alias not in item['aliases']: item['aliases'].append(alias)
            item['appearances'].append(dict(**appearance, node_id=person_id))
        add_node(doc_id, title, 'document')
        passages, claims, identity_evidence = [], [], []
        for index, group in enumerate(inputs[short], 1):
            passage_id = dossier + '-signatures-' + str(index)
            text = '\n'.join(group['lines'])
            passage_hash = hashlib.sha256(text.encode()).hexdigest()
            citation = title + ', signature block (' + group['heading'] + '), National Archives transcription.'
            passage = dict(id=passage_id, source_id=short, text=text, text_sha256=passage_hash,
                url=url, citation=citation, text_scope='selected_excerpt',
                editorial_context=context + ' Names are reproduced in transcription order. ' + inputs['extraction'],
                translation_credit='English source; no translation.',
                license_credit='Public-domain historical signature text. Transcription credit: U.S. National Archives and Records Administration. No endorsement implied.',
                license_scope='public_domain_historical_text')
            passages.append(passage)
            for signature in group['names']:
                identity = mapping.get(signature) if short == 'constitution' else None
                label = identity['label'] if identity else signature
                person_id = ('person-' if label in shared else 'person-' + dossier + '-') + slug(label)
                add_node(person_id, label, 'person', signature)
                if identity: identity_evidence.append(dict(**identity, person_id=person_id))
                claim_id = dossier + '-' + slug(signature)
                claim_text = label + ' is listed in the signature block of the ' + title + '.'
                claims.append(dict(id=claim_id, subject=person_id, object=doc_id,
                    predicate='listed_signature', text=claim_text, passage_ids=[passage_id],
                    relationship_type='listed_signature', date_label=date, date_basis=context,
                    source_signature=signature, source_heading=group['heading'],
                    license_scope='public_domain_historical_text', note=context))
        corpus = dict(dossier=dossiers[-1], sources=[dict(id=short, title=title,
            author='Continental Congress' if short == 'declaration' else 'Federal Convention',
            kind='primary document / modern institutional transcription', url=url,
            edition=credit, provenance_credit=credit,
            perspective='A formal subscription list. Presence in a list does not establish co-authorship, interpersonal contact, unanimity of personal opinion, or completeness of political participation.',
            dependence='Both the transcription and linked identity biographies are from NARA; not independent historical witnesses.',
            rights='Historical signature text only; no images or modern essays reproduced. See THIRD_PARTY_NOTICES.md.')],
            passages=passages, claims=claims, identity_evidence=identity_evidence,
            source_capture=captures[short + '.raw'], input_sha256=digest(inputs))
        corpus_hash = digest(corpus)
        corpus['audit'] = dict(corpus_sha256=corpus_hash, hash_basis='Canonical JSON excluding audit; sorted keys, compact separators, ASCII escapes.',
            source_capture_sha256=captures[short + '.raw']['sha256'])
        revisions[dossier] = corpus_hash
        for claim in claims:
            passage = next(item for item in passages if item['id'] == claim['passage_ids'][0])
            edges.append(dict(id='edge-' + claim['id'], source=claim['subject'], target=doc_id,
                dossier=dossier, dossier_title=title, claim_id=claim['id'], text=claim['text'],
                predicate='listed_signature', relationship_type='listed_signature', relationship_label='Listed signature',
                date_label=date, date_basis=context, date_precision='document_date_only',
                status='source-bound record', review='Independent release checks are documented in RELEASE_REVIEW.md; not institutional certification.',
                note=context, provisional_endpoints=[], region='americas', corpus_sha256=corpus_hash,
                href='/HistoryForge/?dossier=' + dossier + '&claim=' + claim['id'],
                citations=[dict(passage_id=passage['id'], citation=passage['citation'], source=title,
                    url=url, text_sha256=passage['text_sha256'], external_locator_kind='signature_block',
                    license_scope=passage['license_scope'])]))
        write(dossier + '.json', corpus)
    count = Counter(endpoint for edge in edges for endpoint in (edge['source'], edge['target']))
    for node in nodes.values(): node['connection_count'] = count[node['id']]
    tapestry = dict(version=1, nodes=list(nodes.values()), edges=edges, dossiers=dossiers,
        regions=[dict(id='americas', label='Americas', color='#80aff4')], corpus_revisions=revisions,
        counts=dict(entities=len(nodes), connections=len(edges), dossiers=len(dossiers)),
        geography_basis='Regional document context, not nationality or birthplace.',
        scope='Bounded public signatory pilot; not the full private corpus. No inferred personal-contact edges.')
    assert len(edges) == 95 and len(nodes) == 91
    assert len([node for node in nodes.values() if len(node['appearances']) == 2]) == 6
    tapestry['revision'] = digest(tapestry)
    write('tapestry.json', tapestry)
    print(f"Built {len(nodes)} entity records, {len(edges)} source-bound connections, two documents.")

if __name__ == '__main__': build()
