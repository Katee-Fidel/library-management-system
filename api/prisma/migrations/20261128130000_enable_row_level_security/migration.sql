-- Supabase can expose the public schema through its Data API. With row-level
-- security enabled and no policies, roles such as anon and authenticated can
-- neither read nor change rows. The table owner, which Prisma connects as, is
-- not restricted.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Genre" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;

-- Prisma's history table. IF EXISTS because it may be absent from the shadow
-- database that `prisma migrate dev` builds.
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
