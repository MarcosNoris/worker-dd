# Detective Department AI Worker

NestJS CLI worker for generating full AI cases and recovering failed AI case generation runs. It does not start an HTTP server and does not use `@nestjs/schedule`; GitHub Actions owns scheduling.

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

## Verification

```bash
pnpm build
pnpm test
```
