# Domain Docs

How engineering skills should consume this repo's domain documentation.

## Before exploring

- Read `CONTEXT-MAP.md` at the repo root.
- Read each context `CONTEXT.md` relevant to the topic.
- Read applicable system-wide ADRs under `docs/adr/`.
- Also check context-specific `docs/adr/` directories identified by `CONTEXT-MAP.md`.

If any of these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when domain terms or decisions are resolved.

## Use the glossary's vocabulary

When output names a domain concept, use terminology defined in the relevant `CONTEXT.md`. If the needed concept is not documented, flag it as a domain-modeling gap rather than inventing terminology.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it.
