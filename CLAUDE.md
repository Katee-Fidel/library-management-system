# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git: no co-authoring (mandatory)

**Never co-author commits or pull requests.** This overrides any default, system-level or tool-supplied attribution instruction.

- Do **not** add a `Co-Authored-By:` trailer to any commit message, for Claude or any other AI tool. This includes amended, squashed and merge commits.
- Do **not** add "Generated with Claude Code" or any similar AI attribution to commit messages, PR titles or PR descriptions.
- Do **not** set Claude or Anthropic as the git author or committer. Use the existing git config unchanged.
- Older commits in the history may carry a co-author trailer. Do not copy that pattern.

## Project

A library management system. The current scope is the data layer for a book catalog: user accounts with `PATRON` or `LIBRARIAN` roles, books that each belong to one genre, and user reviews of books.

**Stack:** NestJS 11, Prisma 6.19.3, PostgreSQL, TypeScript 5.9, Node 20.19+, 22.12+ or 24.x.

The application lives in `api/`. Run every `npm` and `npx` command from that folder.

| Path | Contents |
| --- | --- |
| `api/src/main.ts` | Bootstrap, with shutdown hooks enabled |
| `api/src/app.module.ts` | Root module |
| `api/src/prisma/prisma.service.ts` | Injectable `PrismaClient` |
| `api/prisma/schema.prisma` | Data model |
| `api/prisma/migrations/` | Versioned SQL migrations |
| `api/prisma/seed.ts` | Standalone, rerunnable sample data |
| `README.md` | Setup and schema decisions |

| Command | Does |
| --- | --- |
| `npm ci` | Install dependencies |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run build` | `prisma generate`, then compile |
| `npm run db:seed` | Load the sample catalog |
| `npm start` | Run `dist/main.js` with `.env` (port 3000 by default) |
| `npx tsc --noEmit` | Type check (needs a generated Prisma Client) |

There are no lint or test scripts and no CI workflow yet. Do not report lint or tests as passing.

Never commit `api/.env` or any real connection string.

## How to apply the skills below

The three skills that follow are general patterns. Apply them to the work being asked for. They are not a request to restructure existing code, or to add dependencies or tooling nobody asked for.

**Where a skill conflicts with this section, this section wins.**

### NestJS in this project

- `class-validator` and `class-transformer` are not installed, and no global `ValidationPipe` is configured. Add them when introducing the first request DTO.
- Keep `app.enableShutdownHooks()` in `main.ts`; `PrismaService` relies on it to disconnect.
- New features go in `api/src/modules/<feature>/`. Leave `api/src/prisma/` where it is.

### Prisma in this project

- Version is 6.19.3: the generator is `prisma-client-js`, the datasource URL stays in `schema.prisma`, and `new PrismaClient()` needs no driver adapter.
- In application code, inject `PrismaService`. Do not add a `lib/prisma.ts` singleton or create other clients. The seed script is the exception because it runs outside NestJS.
- `relationJoins` is not enabled in `schema.prisma`, so do not assume `include` uses a JOIN. The skill's "uses JOIN by default" note does not apply.
- `findUniqueOrThrow({ where: { id, deletedAt: null } })` is valid in this version. Prisma 5+ accepts extra filters alongside a unique field, contrary to the skill's soft-delete example.
- `prisma migrate deploy` is the command for shared, staging and production databases. Run `prisma migrate dev` only against a local, disposable database.
- IDs use `@default(cuid())`.
- Every migration that creates a table must also run `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;`. The database is hosted on Supabase, and Prisma does not add this itself.
- Never edit a migration that has been applied. Add a new one.

### CI/CD in this project

- Workflows must set `working-directory: api` and `cache-dependency-path: api/package-lock.json`.
- Run `npx prisma generate` before type checking.
- Add `lint` and `test` scripts before making CI depend on them.
- Use `postgres:17` for CI databases, matching the README.
- `.gitignore` ignores every `.env.*` except `.env.example`, so `.env.test` is not committed.

---

## Skill: NestJS Development Patterns

Production-grade NestJS patterns for modular TypeScript backends.

### When to Activate

- Building NestJS APIs or services
- Structuring modules, controllers, and providers
- Adding DTO validation, guards, interceptors, or exception filters
- Configuring environment-aware settings and database integrations
- Testing NestJS units or HTTP endpoints

### Project Structure

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/
│   ├── configuration.ts
│   └── validation.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   └── users/
│       ├── dto/
│       ├── entities/
│       ├── users.controller.ts
│       ├── users.module.ts
│       └── users.service.ts
└── prisma/ or database/
```

- Keep domain code inside feature modules.
- Put cross-cutting filters, decorators, guards, and interceptors in `common/`.
- Keep DTOs close to the module that owns them.

### Bootstrap and Global Validation

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- Always enable `whitelist` and `forbidNonWhitelisted` on public APIs.
- Prefer one global validation pipe instead of repeating validation config per route.

### Modules, Controllers, and Providers

```ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async create(dto: CreateUserDto) {
    return this.usersRepo.create(dto);
  }
}
```

- Controllers should stay thin: parse HTTP input, call a provider, return response DTOs.
- Put business logic in injectable services, not controllers.
- Export only the providers other modules genuinely need.

> Project note: IDs here are cuids, so do not use `ParseUUIDPipe` on them.

### DTOs and Validation

```ts
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
```

- Validate every request DTO with `class-validator`.
- Use dedicated response DTOs or serializers instead of returning ORM entities directly.
- Avoid leaking internal fields such as password hashes, tokens, or audit columns.

### Auth, Guards, and Request Context

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Get('admin/report')
getAdminReport(@Req() req: AuthenticatedRequest) {
  return this.reportService.getForUser(req.user.id);
}
```

- Keep auth strategies and guards module-local unless they are truly shared.
- Encode coarse access rules in guards, then do resource-specific authorization in services.
- Prefer explicit request types for authenticated request objects.

### Exception Filters and Error Shape

```ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        path: request.url,
        error: exception.getResponse(),
      });
    }

    return response.status(500).json({
      path: request.url,
      error: 'Internal server error',
    });
  }
}
```

- Keep one consistent error envelope across the API.
- Throw framework exceptions for expected client errors; log and wrap unexpected failures centrally.

### Config and Environment Validation

```ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  validate: validateEnv,
});
```

- Validate env at boot, not lazily at first request.
- Keep config access behind typed helpers or config services.
- Split dev/staging/prod concerns in config factories instead of branching throughout feature code.

### Persistence and Transactions

- Keep repository / ORM code behind providers that speak domain language.
- For Prisma or TypeORM, isolate transactional workflows in services that own the unit of work.
- Do not let controllers coordinate multi-step writes directly.

### Testing

```ts
describe('UsersController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
});
```

- Unit test providers in isolation with mocked dependencies.
- Add request-level tests for guards, validation pipes, and exception filters.
- Reuse the same global pipes/filters in tests that you use in production.

### Production Defaults

- Enable structured logging and request correlation ids.
- Terminate on invalid env/config instead of booting partially.
- Prefer async provider initialization for DB/cache clients with explicit health checks.
- Keep background jobs and event consumers in their own modules, not inside HTTP controllers.
- Make rate limiting, auth, and audit logging explicit for public endpoints.

---

## Skill: Prisma Patterns

Production patterns and non-obvious traps for Prisma ORM in TypeScript backends.

Check your version before applying patterns. The Prisma API surface has evolved across major releases:

```bash
npx prisma --version
```

Notable API differences across versions:

- `relationJoins` can load relations via JOIN rather than separate queries, but may cause row explosion on large 1:N relations or deep `include` — benchmark both approaches
- `omit` field modifier and `prisma.$extends` Client Extensions API were added
- Newer installs: the package may be named `prisma` instead of `@prisma/client`; `PrismaClient` may require a driver adapter (e.g. `@prisma/adapter-pg`); `datasource.url` may live in `prisma.config.ts` instead of `schema.prisma`
- CLI commands (`migrate dev`, `migrate deploy`, `generate`) are unchanged across versions

### When to Activate

- Designing or modifying Prisma schema models and relations
- Writing queries, transactions, or pagination logic
- Using `updateMany`, `deleteMany`, or any bulk operation
- Running or planning database migrations
- Deploying to serverless environments (Vercel, Lambda, Cloudflare Workers)
- Implementing soft delete or multi-tenant row filtering

### Core Concepts

#### ID Strategy

| Strategy | Use When | Avoid When |
| --- | --- | --- |
| `@default(cuid())` | Default choice — URL-safe, sortable, no collisions | Sequential IDs needed for external systems |
| `@default(uuid())` | Interoperability with non-Prisma systems required | High-write tables (random UUIDs fragment B-tree indexes) |
| `@default(autoincrement())` | Internal join tables, audit logs | Public-facing IDs (exposes record count) |

#### Schema Defaults

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique  // @unique already creates an index — no @@index needed
  name      String
  role      Role      @default(USER)
  posts     Post[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([createdAt])
  @@index([deletedAt, createdAt]) // composite for soft-delete + sort queries
}
```

- Add `@@index` on every foreign key and column used in `WHERE` or `ORDER BY`.
- Declare `deletedAt DateTime?` upfront when soft delete is a foreseeable requirement — adding it later requires a migration on a live table.
- `updatedAt @updatedAt` is set automatically by Prisma on `update` and `upsert` only (see Anti-Patterns for bulk update trap).

#### `include` vs `select`

| | `include` | `select` |
| --- | --- | --- |
| Returns | All scalar fields + specified relations | Only specified fields |
| Use when | You need most fields plus a relation | Hot paths, large tables, avoiding over-fetch |
| Performance | May over-fetch on wide tables | Minimal payload, faster on large datasets |
| Prisma 5 note | Uses JOIN by default (`relationJoins`) | Same |

```ts
// include — all columns + relation
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: { select: { id: true, title: true } } },
});

// select — explicit allowlist
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true },
});
```

Never return raw Prisma entities from API responses — map to response DTOs to control exposed fields:

```ts
// BAD: leaks passwordHash, deletedAt, internal fields
return await prisma.user.findUniqueOrThrow({ where: { id } });

// GOOD: explicit DTO mapping
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
return { id: user.id, name: user.name, email: user.email };
```

#### Transaction Form Selection

| Situation | Use |
| --- | --- |
| Independent operations, no inter-dependency | Array form |
| Later step depends on earlier result | Interactive form |
| External calls (email, HTTP) involved | Outside transaction entirely |

```ts
// Array form — batched in one round trip
const [user, post] = await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { name } }),
  prisma.post.create({ data: { title, authorId: id } }),
]);

// Interactive form — use tx client only, never the outer prisma client
const post = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  if (user.role !== 'ADMIN') throw new Error('Forbidden');
  return tx.post.create({ data: { title, authorId: user.id } });
});
```

#### PrismaClient Singleton

Each `PrismaClient` instance opens its own connection pool. Instantiate once.

```ts
// lib/prisma.ts

// Option A — adapter-based initialization (required by newer Prisma installs)
import { PrismaClient } from '@prisma/client'; // or the generated client path for your setup
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Option B — direct initialization (older installs, no adapter needed)
// import { PrismaClient } from '@prisma/client';
// export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... });
```

Use Option A if your Prisma install requires an `adapter` argument in the `PrismaClient` constructor. Use Option B if `new PrismaClient()` works without arguments. Let the compiler tell you which is correct.

The `globalThis` pattern prevents duplicate instances during hot reload (Next.js, nodemon, ts-node-dev).

#### N+1 Problem

Loading relations inside a loop issues one query per row.

```ts
// BAD: N+1 — one extra query per user
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// GOOD: single query
const users = await prisma.user.findMany({ include: { posts: true } });
```

With Prisma 5+ `relationJoins`, the `include` form uses a single JOIN. On large 1:N sets this may increase result set size — benchmark both approaches if the relation can return many rows per parent.

### Code Examples

#### Cursor Pagination (preferred for feeds and large datasets)

```ts
async function getPosts(cursor?: string, limit = 20) {
  const items = await prisma.post.findMany({
    where: { published: true },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }, // secondary sort prevents unstable pagination on duplicate timestamps
    ],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop();

  return { items, nextCursor: hasNextPage ? items[items.length - 1].id : null };
}
```

Fetch `limit + 1` and pop — canonical way to detect `hasNextPage` without an extra count query. Always include a unique field (e.g. `id`) as a secondary `orderBy` to prevent unstable pagination when multiple rows share the same timestamp. Use offset pagination only when users need to jump to arbitrary pages (admin tables).

#### Soft Delete

```ts
// Always filter explicitly — do not rely on middleware (hides behavior, hard to debug)
const activeUsers = await prisma.user.findMany({ where: { deletedAt: null } });

await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
await prisma.user.update({ where: { id }, data: { deletedAt: null } }); // restore
```

#### Error Handling

```ts
import { Prisma } from '@prisma/client'; // or the generated client path for your setup

try {
  await prisma.user.create({ data: { email } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictError('Email already exists');
    if (e.code === 'P2025') throw new NotFoundError('Record not found');
    if (e.code === 'P2003') throw new BadRequestError('Referenced record does not exist');
  }
  throw e;
}
```

Common codes: `P2002` unique violation · `P2025` not found · `P2003` foreign key violation.

Catch at the service boundary and translate to domain errors. Never expose raw Prisma messages to API consumers.

#### Connection Pool — Serverless

Embed connection params directly in `DATABASE_URL` — string concatenation breaks if the URL already has query parameters (e.g. `?schema=public`):

```bash
# .env — preferred: embed params in the URL
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=1&pool_timeout=20"

# With an external pooler (PgBouncer, Supabase pooler)
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1"
```

```ts
// Vercel, AWS Lambda, and similar serverless runtimes:
// cap pool to 1 per instance; connection_limit and pool_timeout controlled via DATABASE_URL

// Adapter-based setup (if your Prisma install requires an adapter):
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Direct setup (if your Prisma install does not require an adapter):
// const prisma = new PrismaClient();
```

### Anti-Patterns

#### `updateMany` returns a count, not records

```ts
// BAD: result is { count: 2 } — users[0] is undefined
const users = await prisma.user.updateMany({ where: { role: 'GUEST' }, data: { role: 'USER' } });

// GOOD: capture IDs first, then update, then fetch only the affected rows
const targets = await prisma.user.findMany({
  where: { role: 'GUEST' },
  select: { id: true },
});
const ids = targets.map((u) => u.id);
await prisma.user.updateMany({ where: { id: { in: ids } }, data: { role: 'USER' } });
const updated = await prisma.user.findMany({ where: { id: { in: ids } } });
```

Same applies to `deleteMany` — returns `{ count: n }`, never the deleted rows.

#### `$transaction` interactive form times out after 5 seconds

```ts
// BAD: external call inside transaction exceeds 5s default → "Transaction already closed"
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  await sendWelcomeEmail(user.email); // external call
  await tx.user.update({ where: { id }, data: { emailSent: true } });
});

// GOOD: external calls outside the transaction
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
await sendWelcomeEmail(user.email);
await prisma.user.update({ where: { id }, data: { emailSent: true } });

// Only raise timeout when bulk processing genuinely needs it
await prisma.$transaction(async (tx) => { ... }, { timeout: 30_000 });
```

#### `migrate dev` can reset the database

`migrate dev` detects schema drift and may prompt to reset the DB, dropping all data.

```bash
# NEVER on shared dev, staging, or production
npx prisma migrate dev --name add_column

# Safe everywhere except local solo dev
npx prisma migrate deploy

# Check drift without applying
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

#### Manually editing a migration file breaks future deploys

Prisma checksums every migration file. Editing after apply causes `P3006` checksum mismatch on every environment where the original already ran. Create a new migration instead.

#### Breaking schema changes require multi-step migration

Adding `NOT NULL` to an existing column or renaming a column in one migration will lock the table or drop data. Use expand-and-contract:

```bash
# Step 1: create migration locally, then deploy
npx prisma migrate dev --name add_new_column   # local only
npx prisma migrate deploy                       # staging / production
```

```ts
// Step 2: backfill data (run in a script or migration job, not in the shell)
await prisma.user.updateMany({ data: { newColumn: derivedValue } });
```

```bash
# Step 3: create the NOT NULL constraint migration locally, then deploy
npx prisma migrate dev --name make_new_column_required  # local only
npx prisma migrate deploy                               # staging / production
```

#### `@updatedAt` does not fire on `updateMany`

`@updatedAt` is set automatically only on `update` and `upsert`. Bulk writes leave it stale.

```ts
// BAD: updatedAt stays at its old value
await prisma.post.updateMany({ where: { authorId }, data: { published: true } });

// GOOD
await prisma.post.updateMany({
  where: { authorId },
  data: { published: true, updatedAt: new Date() },
});
```

#### Soft delete + `findUniqueOrThrow` leaks deleted records

`findUniqueOrThrow` throws `P2025` only when the row does not exist in the DB. Soft-deleted rows still exist and are returned without error.

`findUniqueOrThrow` requires a unique constraint field in `where` — adding `deletedAt: null` alongside `id` breaks the type because `{ id, deletedAt }` is not a compound unique constraint. Use `findFirstOrThrow` instead.

```ts
// BAD: returns soft-deleted user
const user = await prisma.user.findUniqueOrThrow({ where: { id } });

// BAD: Prisma type error — { id, deletedAt } is not a unique constraint
const user = await prisma.user.findUniqueOrThrow({ where: { id, deletedAt: null } });

// GOOD: findFirstOrThrow supports arbitrary where conditions
const user = await prisma.user.findFirstOrThrow({ where: { id, deletedAt: null } });
```

#### `deleteMany` without `where` deletes every row

```ts
// BAD: silently wipes the table
await prisma.post.deleteMany();

// GOOD
await prisma.post.deleteMany({ where: { authorId: userId } });
```

### Best Practices

| Rule | Reason |
| --- | --- |
| `migrate deploy` in CI/CD, `migrate dev` only locally | `migrate dev` can reset the DB on drift |
| Map entities to response DTOs | Prevents leaking internal fields |
| Catch `PrismaClientKnownRequestError` at service boundary | Translate to domain errors |
| Prefer `*OrThrow` methods over manual null checks | Throws `P2025` automatically; use `findFirstOrThrow` when filtering non-unique fields |
| `connection_limit=1` + external pooler in serverless | Prevents connection exhaustion |
| Always provide `where` on `deleteMany` | Prevents accidental table wipe |
| Set `updatedAt: new Date()` manually in `updateMany` | `@updatedAt` skips bulk writes |

### Related Skills

- `nestjs-patterns` — NestJS service layer that integrates Prisma
- `postgres-patterns` — PostgreSQL-level indexing and connection tuning
- `database-migrations` — multi-step migration planning for production
- `backend-patterns` — general API and service layer design

---

## Skill: CI/CD and Automation

### Overview

Automate quality gates so that no change reaches production without passing tests, lint, type checking, and build. CI/CD is the enforcement mechanism for every other skill — it catches what humans and agents miss, and it does so consistently on every single change.

**Shift Left:** Catch problems as early in the pipeline as possible. A bug caught in linting costs minutes; the same bug caught in production costs hours. Move checks upstream — static analysis before tests, tests before staging, staging before production.

**Faster is Safer:** Smaller batches and more frequent releases reduce risk, not increase it. A deployment with 3 changes is easier to debug than one with 30. Frequent releases build confidence in the release process itself.

### When to Use

- Setting up a new project's CI pipeline
- Adding or modifying automated checks
- Configuring deployment pipelines
- When a change should trigger automated verification
- Debugging CI failures

### The Quality Gate Pipeline

Every change goes through these gates before merge:

```
Pull Request Opened
    │
    ▼
┌─────────────────┐
│   LINT CHECK     │  eslint, prettier
│   ↓ pass         │
│   TYPE CHECK     │  tsc --noEmit
│   ↓ pass         │
│   UNIT TESTS     │  jest/vitest
│   ↓ pass         │
│   BUILD          │  npm run build
│   ↓ pass         │
│   INTEGRATION    │  API/DB tests
│   ↓ pass         │
│   E2E (optional) │  Playwright/Cypress
│   ↓ pass         │
│   SECURITY AUDIT │  npm audit
│   ↓ pass         │
│   BUNDLE SIZE    │  bundlesize check
└─────────────────┘
    │
    ▼
  Ready for review
```

No gate can be skipped. If lint fails, fix lint — don't disable the rule. If a test fails, fix the code — don't skip the test.

### GitHub Actions Configuration

#### Basic CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test -- --coverage

      - name: Build
        run: npm run build

      - name: Security audit
        run: npm audit --audit-level=high
```

#### With Database Integration Tests

```yaml
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: ci_user
          POSTGRES_PASSWORD: ${{ secrets.CI_DB_PASSWORD }}
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
```

Note: Even for CI-only test databases, use GitHub Secrets for credentials rather than hardcoding values. This builds good habits and prevents accidental reuse of test credentials in other contexts.

#### E2E Tests

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Build
        run: npm run build
      - name: Run E2E tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Feeding CI Failures Back to Agents

The power of CI with AI agents is the feedback loop. When CI fails:

```
CI fails
    │
    ▼
Copy the failure output
    │
    ▼
Feed it to the agent:
"The CI pipeline failed with this error:
[paste specific error]
Fix the issue and verify locally before pushing again."
    │
    ▼
Agent fixes → pushes → CI runs again
```

Key patterns:

- Lint failure → Agent runs `npm run lint -- --fix` and commits
- Type error → Agent reads the error location and fixes the type
- Test failure → Agent follows debugging-and-error-recovery skill
- Build error → Agent checks config and dependencies

### Deployment Strategies

#### Preview Deployments

Every PR gets a preview deployment for manual testing:

```yaml
# Deploy preview on PR (Vercel/Netlify/etc.)
deploy-preview:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy preview
      run: npx vercel --token=${{ secrets.VERCEL_TOKEN }}
```

#### Feature Flags

Feature flags decouple deployment from release. Deploy incomplete or risky features behind flags so you can:

- **Ship code without enabling it.** Merge to main early, enable when ready.
- **Roll back without redeploying.** Disable the flag instead of reverting code.
- **Canary new features.** Enable for 1% of users, then 10%, then 100%.
- **Run A/B tests.** Compare behavior with and without the feature.

```ts
// Simple feature flag pattern
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return renderNewCheckout();
}
return renderLegacyCheckout();
```

**Flag lifecycle:** Create → Enable for testing → Canary → Full rollout → Remove the flag and dead code. Flags that live forever become technical debt — set a cleanup date when you create them.

#### Staged Rollouts

```
PR merged to main
    │
    ▼
  Staging deployment (auto)
    │ Manual verification
    ▼
  Production deployment (manual trigger or auto after staging)
    │
    ▼
  Monitor for errors (15-minute window)
    │
    ├── Errors detected → Rollback
    └── Clean → Done
```

#### Rollback Plan

Every deployment should be reversible:

```yaml
# Manual rollback workflow
name: Rollback
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback deployment
        env:
          VERSION: ${{ inputs.version }}
        run: |
          # Deploy the specified previous version. Pass the input through env,
          # never interpolate it into the script (shell injection).
          npx vercel rollback "$VERSION"
```

### Environment Management

```
.env.example       → Committed (template for developers)
.env                → NOT committed (local development)
.env.test           → Committed (test environment, no real secrets)
CI secrets          → Stored in GitHub Secrets / vault
Production secrets  → Stored in deployment platform / vault
```

CI should never have production secrets. Use separate secrets for CI testing.

### Automation Beyond CI

#### Dependabot / Renovate

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

> Project note: `package.json` is in `api/`, so use `directory: /api`.

#### Build Cop Role

Designate someone responsible for keeping CI green. When the build breaks, the Build Cop's job is to fix or revert — not the person whose change caused the break. This prevents broken builds from accumulating while everyone assumes someone else will fix it.

#### PR Checks

- **Required reviews:** At least 1 approval before merge
- **Required status checks:** CI must pass before merge
- **Branch protection:** No force-pushes to main
- **Auto-merge:** If all checks pass and approved, merge automatically

### CI Optimization

When the pipeline exceeds 10 minutes, apply these strategies in order of impact:

```
Slow CI pipeline?
├── Cache dependencies
│   └── Use the setup-node cache option (or actions/cache) for the package manager cache, not node_modules
├── Run jobs in parallel
│   └── Split lint, typecheck, test, build into separate parallel jobs
├── Only run what changed
│   └── Use path filters to skip unrelated jobs (e.g., skip e2e for docs-only PRs)
├── Use matrix builds
│   └── Shard test suites across multiple runners
├── Optimize the test suite
│   └── Remove slow tests from the critical path, run them on a schedule instead
└── Use larger runners
    └── GitHub-hosted larger runners or self-hosted for CPU-heavy builds
```

Example: caching and parallelism

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage
```

### Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "CI is too slow" | Optimize the pipeline (see CI Optimization above), don't skip it. A 5-minute pipeline prevents hours of debugging. |
| "This change is trivial, skip CI" | Trivial changes break builds. CI is fast for trivial changes anyway. |
| "The test is flaky, just re-run" | Flaky tests mask real bugs and waste everyone's time. Fix the flakiness. |
| "We'll add CI later" | Projects without CI accumulate broken states. Set it up on day one. |
| "Manual testing is enough" | Manual testing doesn't scale and isn't repeatable. Automate what you can. |

### Red Flags

- No CI pipeline in the project
- CI failures ignored or silenced
- Tests disabled in CI to make the pipeline pass
- Production deploys without staging verification
- No rollback mechanism
- Secrets stored in code or CI config files (not secrets manager)
- Long CI times with no optimization effort

### Verification

After setting up or modifying CI:

- [ ] All quality gates are present (lint, types, tests, build, audit)
- [ ] Pipeline runs on every PR and push to main
- [ ] Failures block merge (branch protection configured)
- [ ] CI results feed back into the development loop
- [ ] Secrets are stored in the secrets manager, not in code
- [ ] Deployment has a rollback mechanism
- [ ] Pipeline runs in under 10 minutes for the test suite
