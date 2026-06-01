# Rules Module

## Purpose

This worker keeps a small subset of the API rules module so AI-generated investigation actions can validate operational metadata before persisting a case graph.

## Endpoints

This module exposes no HTTP endpoints in `dd-worker`.

## Consumers

- `src/modules/ai/types/ai.types.ts` imports operational metadata types.
- `src/modules/ai/openai-compatible/generated-case-investigation-graph.normalizer.ts` imports allowed acceleration and institutional access values.

## Security

The module does not read user input directly and does not perform persistence. It only exposes deterministic constants, types, and rule helpers.

## Main Files

- `investigation-acceleration-rule.service.ts`: acceleration types, operational categories, and acceleration rule lookup.
- `institutional-access-rule.service.ts`: institutional access values and reputation-based access helpers.

## Pending

If the worker starts executing investigation actions directly, this subset should be revisited against the API rules module before adding behavior.
