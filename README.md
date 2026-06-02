# Detective Department AI Worker

NestJS CLI worker for generating full AI cases and recovering failed AI case generation runs. It does not start an HTTP server and does not use `@nestjs/schedule`; GitHub Actions owns scheduling.

Generated cases follow the current V2 case contract used by the API:

- New cases are persisted with `version = 2`.
- Evidence counts are `easy=6`, `medium=8`, `hard=10`, `expert=12`.
- Evidence metadata is normalized into a proof matrix with one core evidence for each `identity`, `motive`, `method`, and `opportunity`.
- Extra evidence is normalized as `support` or `false_alibi`; one evidence must not prove multiple core solve requirements.
- Solve requirements enforce mandatory coverage for `culprit`, `identity`, `motive`, `method`, and `opportunity`, with 1:1 mandatory proof targets.
- Contradictions are stored with `isInitiallyVisible=false`; gameplay discovery is handled by statement + refuting evidence deduction.
- A fully valid generated case is published as `playable` after the playability validator passes.

## Commands

```bash
pnpm install
pnpm build
pnpm worker:create-case
pnpm worker:recover-cases
```

The compiled CLI accepts:

```bash
node dist/main create-case
node dist/main recover-cases
```

## Required Environment

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AI_CASE_CRON_USER_ID=
```

AI provider variables are listed in `env.example`. Recovery defaults to a batch size of `2` unless `AI_CASE_RECOVERY_BATCH_LIMIT` is set.

The worker publishes valid cases into the shared playable V2 pool. Department-specific offers are still created by the API department offer flow, which filters playable cases by `version = 2`.

## Verification

```bash
pnpm build
pnpm test
```
