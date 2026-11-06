# Learnit: CampusOS study pack

## Presentation guides

- [Specialization and generalization (PDF)](Specialization_Generalization.pdf) — concepts, constraints, mapping strategies and honest CampusOS implementation comparison. [Editable HTML](Specialization_Generalization.html).
- [Presentation browser and DBeaver setup](Presentation_Setup.md) · [SQL activity query](Presentation_SQL_Log.sql).

- [10-minute use-case presentation (PDF)](usecase.pdf) — frontend/backend developer presentation: stack choices, component architecture, integration, admin/student tabs and SQL activity; brief PK/FK reference, no ER diagrams. [Editable HTML](usecase.html).
- [Short viva speaking guide (PDF)](Viva_Guide.pdf) · [Editable HTML](Viva_Guide.html).

## Current extended implementation (16 tables)

Start with [Portal ER explanation](Portal_ER.md): 12 domain tables plus 4 authentication/support tables, derived from the current `web/lib/schema.mjs` and `web/lib/portal.mjs`.

- **Conceptual domain ER (Chen-inspired):** [SVG / editable source](CampusOS_Conceptual_ER.svg) · [PNG](CampusOS_Conceptual_ER.png) · [PDF](CampusOS_Conceptual_ER.pdf)
- **Complete relational ER:** [SVG / editable source](CampusOS_Relational_ER.svg) · [PNG](CampusOS_Relational_ER.png)
- [Exact schema inventory](CampusOS_schema.json) · [Reproducible Chromium renderer](render-campus-er.mjs)

```sh
node learnit/render-campus-er.mjs
```

Uses the existing `web` Puppeteer dependency and system Chromium; no installation required. The conceptual diagram adopts the supplied hospital report's page-2 notation, not its topology or inheritance. See the explanation for precise cardinalities, constraints and role semantics.

## Historical academic9 study pack

The original nine-table diagrams and chapters below are preserved unchanged. They do **not** cover the current portal's attendance, library or authentication tables.


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
