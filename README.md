# Library Management System

This assignment builds the data layer for a book catalog. It stores user accounts with patron or librarian roles and classifies each book under one genre.

## Architecture

| Layer | What it does |
| --- | --- |
| NestJS | Starts the backend and manages `PrismaService` through dependency injection. The service connects during startup and disconnects during shutdown. |
| Prisma ORM | Reads the models in `api/prisma/schema.prisma`, generates a typed client, and applies versioned SQL migrations. |
| PostgreSQL | Stores the catalog and enforces foreign keys, uniqueness, and allowed role values. |
| Seed script | Loads four genres and 16 books in one transaction. Rerunning the seed updates the same sample records. |

## Setup

Install Node.js 20.19+, 22.12+, or 24.x, with npm, and create a dedicated PostgreSQL database. The examples below use PowerShell from the repository root.

```powershell
Set-Location api
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `api/.env` and set `DATABASE_URL`. Git ignores this file.

- **Local PostgreSQL.** Connect to your PostgreSQL 17 instance on port `5433` in pgAdmin or `psql` and create a database named `library_management`. Use `postgresql://USER:PASSWORD@127.0.0.1:5433/library_management?schema=public`, replacing the role and password with your local login. Percent-encode special characters in the password, such as `@` as `%40`.
- **Hosted PostgreSQL.** For Supabase, open the project dashboard's **Connect** dialog and copy the Session pooler connection string on port `5432`. Save it as `DATABASE_URL` in `api/.env.hosted`. This works over IPv4 for Prisma migrations. Keep the provider's TLS options in the URL and never commit the environment file.

```powershell
npm run db:migrate
npm run build
npm run db:seed
npm start
```

The migration creates the tables and constraints. The build generates the Prisma Client and compiles the NestJS application. The seed adds the sample catalog. NestJS connects to the database on startup and listens for HTTP on port 3000 by default. Open Prisma Studio from another terminal in `api` to browse the catalog.

```powershell
npx prisma studio
```

## Schema Decisions

`Book.genreId` references `Genre.id`. A genre can classify many books, and every book has one genre. Storing a genre in a single row gives its name one place to change and lets PostgreSQL reject books whose genre does not exist. Embedding a genre in every book would repeat the name and require updating each copy during a rename. The foreign key also prevents deleting a genre while books still reference it, and its index supports filtering the catalog by genre.

`User.email` is unique. `User.role` uses the `Role` enum and defaults to `PATRON`. The other allowed value is `LIBRARIAN`. The enum records the user's role for later authorization checks.

In a document database, a book could embed a genre label and read it directly from the document. With Prisma and PostgreSQL, I modeled the genre as a shared row and made the link explicit so the database can enforce it on every write.
