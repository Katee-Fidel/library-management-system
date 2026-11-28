# Library Management System

This assignment builds the data layer for a book catalog. It stores user accounts with patron or librarian roles, classifies each book under one genre, and records users' reviews of books.

## Architecture

| Layer | What it does |
| --- | --- |
| NestJS | Starts the backend and manages `PrismaService` through dependency injection. The service connects during startup and disconnects during shutdown. |
| Prisma ORM | Reads the models in `api/prisma/schema.prisma`, generates a typed client, and applies versioned SQL migrations. |
| PostgreSQL | Stores the catalog and enforces foreign keys, uniqueness, allowed role values, and the review rating range. |
| Seed script | Loads four genres and 16 books in one transaction. Rerunning the seed updates the same sample records. |

## Setup

Install Node.js 20.19+, 22.12+, or 24.x, with npm, and create a dedicated PostgreSQL database. The examples below use PowerShell, starting from the repository root. Run every `npm` and `npx` command from the `api` folder, which holds `package.json` and `package-lock.json`. `npm ci` fails if you run it from the repository root.

```powershell
Set-Location api
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `api/.env` and set `DATABASE_URL`. Git ignores this file.

- **Local PostgreSQL.** Connect to your PostgreSQL 17 instance in pgAdmin or `psql` and create a database named `library_management`. Use `postgresql://USER:PASSWORD@127.0.0.1:5432/library_management?schema=public`, replacing the role and password with your local login. `5432` is the default port; change it if your server uses another. Percent-encode special characters in the password, such as `@` as `%40`.
- **Hosted PostgreSQL.** For Supabase, open the project dashboard's **Connect** dialog and copy the Session pooler connection string on port `5432`. Save it as `DATABASE_URL` in `api/.env`. This works over IPv4 for Prisma migrations. Keep the provider's TLS options in the URL and never commit the environment file.

```powershell
npm run db:migrate
npm run build
npm run db:seed
npm start
```

The migrations create the tables and constraints. The build generates the Prisma Client and compiles the NestJS application. The seed adds the sample catalog. NestJS connects to the database on startup and listens for HTTP on port 3000 by default. Open Prisma Studio from another terminal in `api` to browse the catalog.

```powershell
npx prisma studio
```

## Schema Decisions

`Book.genreId` references `Genre.id`. A genre can classify many books, and every book has one genre. Storing a genre in a single row gives its name one place to change and lets PostgreSQL reject books whose genre does not exist. Embedding a genre in every book would repeat the name and require updating each copy during a rename. The foreign key also prevents deleting a genre while books still reference it, and its index supports filtering the catalog by genre.

`User.email` is unique. `User.role` uses the `Role` enum and defaults to `PATRON`. The other allowed value is `LIBRARIAN`. The enum records the user's role for later authorization checks.

`Review` links a user to a book through `userId` and `bookId`, and stores a `rating` with an optional `comment`. A review carries its own data, so it is a model rather than a plain many-to-many link. A unique constraint on `bookId` and `userId` allows one review per user per book. A `CHECK` constraint limits ratings to 1 through 5; it is written in the migration SQL because the Prisma schema cannot express it. Deleting a book or a user also deletes the related reviews, because a review needs both.

Every table has row-level security enabled with no policies. Supabase can expose the `public` schema through its Data API, and this stops the `anon` and `authenticated` roles from reading or changing rows that way. Prisma connects as the table owner, which row-level security does not restrict, so the role in `DATABASE_URL` must own the tables. A migration that adds a table must enable row-level security on it.

In a document database, a book could embed a genre label and read it directly from the document. With Prisma and PostgreSQL, I modeled the genre as a shared row and made the link explicit so the database can enforce it on every write.
