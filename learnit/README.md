# Learnit: CampusOS study pack

## Presentation guides

- [Specialization and generalization (PDF)](Specialization_Generalization.pdf) — concepts, constraints, mapping strategies and honest CampusOS implementation comparison. [Editable HTML](Specialization_Generalization.html).
- [Presentation browser and DBeaver setup](Presentation_Setup.md) · [SQL activity query](Presentation_SQL_Log.sql).

- [10-minute use-case presentation (PDF)](usecase.pdf) — frontend/backend developer presentation: stack choices, component architecture, integration, admin/student tabs and SQL activity; brief PK/FK reference, no ER diagrams. [Editable HTML](usecase.html).
- [Short viva speaking guide (PDF)](Viva_Guide.pdf) · [Editable HTML](Viva_Guide.html).

## Current implementation (18 tables)

- [Read-only SQLite query worksheet](Explore_CampusOS_SQL.sql) — ready-to-run examples for checking saved student/enrollment/grade records and Person/contact data. [Admin panel SQL guide](Admin_SQL_Guide.md) explains actual application queries versus standalone examples.



- [Portal ER explanation](Portal_ER.md): core portal tables and relationships. The extra Person/contact layer is documented in the current v2 atlas and managed in the website at `/eer`.
- Historical academic9 diagrams and chapters below are preserved unchanged; they do **not** describe the additive Person/contact layer.


## Normalization and model documentation

The detailed current SQLite entity dictionary and EER extension are in [CampusOS_ER_EER_v2.pdf](CampusOS_ER_EER_v2.pdf); old nine-table diagrams below are historical.

The library feature has been removed from the current website and its two legacy SQLite tables are dropped at runtime startup. Older study-pack pages, diagrams and PDFs may still describe the library as historical/earlier-version content.


The syllabus image is **unavailable** in this session. Topic mapping in [topics.md](topics.md) is based on the prior discussion supplied in the request, not on claimed image access. It is a topic checklist, not a verified transcription of an official syllabus.

Read in order:

1. [ER diagram and participation](ER_Diagram.md) — all nine entities, attributes, keys and corrected minima.
2. [Worked normalization](Normalization.md) — 1NF → 2NF → 3NF, actual composite identities and lossless reasoning.
3. [Architecture and DBMS mapping](Architecture.md) — why these choices, SQL examples, local SQLite versus original PostgreSQL.
4. [Short viva and constraint values](Viva.md).

Sources inspected: `../docs/ER_Diagram.mmd`, `../docs/ER_Diagram.md`, `../docs/ER_Explanation.md`, `../docs/Normalization.md`, `../docs/Database_Constraints.md`, `../database/schema.sql`, and `../web/lib/{schema.mjs,api.mjs,README.md}`. These existing sources are unchanged; corrections live only here. This pack is documentation, not a new application implementation or evidence of a running database server.

## Rendering

[Mermaid source](ER_Diagram.mmd), [SVG](ER_Diagram.svg), [PNG](ER_Diagram.png). `puppeteer.config.json` points to `/usr/bin/chromium`. If the supplied CLI exists:

```sh
/tmp/node_modules/.bin/mmdc -p learnit/puppeteer.config.json -i learnit/ER_Diagram.mmd -o learnit/ER_Diagram.svg -b white
/tmp/node_modules/.bin/mmdc -p learnit/puppeteer.config.json -i learnit/ER_Diagram.mmd -o learnit/ER_Diagram.png -b white -s 2
file learnit/ER_Diagram.png learnit/ER_Diagram.svg
```

That supplied CLI path was absent here. Rendering used a temporary Mermaid CLI installation entirely under `learnit/`, removed after rendering. To reproduce when the shared CLI is absent, install `@mermaid-js/mermaid-cli` under a local prefix and substitute its `node_modules/.bin/mmdc` path in these commands.
