# Learnit: corrected CampusOS study pack

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
