import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const catalog = [
  {
    genre: 'Mystery',
    books: [
      { id: 'hound-of-the-baskervilles', title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle' },
      { id: 'murder-on-the-orient-express', title: 'Murder on the Orient Express', author: 'Agatha Christie' },
      { id: 'the-maltese-falcon', title: 'The Maltese Falcon', author: 'Dashiell Hammett' },
      { id: 'the-big-sleep', title: 'The Big Sleep', author: 'Raymond Chandler' },
    ],
  },
  {
    genre: 'Science Fiction',
    books: [
      { id: 'dune', title: 'Dune', author: 'Frank Herbert' },
      { id: 'foundation', title: 'Foundation', author: 'Isaac Asimov' },
      { id: 'the-time-machine', title: 'The Time Machine', author: 'H. G. Wells' },
      { id: 'left-hand-of-darkness', title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin' },
    ],
  },
  {
    genre: 'Fantasy',
    books: [
      { id: 'the-hobbit', title: 'The Hobbit', author: 'J. R. R. Tolkien' },
      { id: 'wizard-of-earthsea', title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin' },
      { id: 'the-last-unicorn', title: 'The Last Unicorn', author: 'Peter S. Beagle' },
      { id: 'the-neverending-story', title: 'The Neverending Story', author: 'Michael Ende' },
    ],
  },
  {
    genre: 'Literary Fiction',
    books: [
      { id: 'things-fall-apart', title: 'Things Fall Apart', author: 'Chinua Achebe' },
      { id: 'beloved', title: 'Beloved', author: 'Toni Morrison' },
      { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
      { id: 'a-grain-of-wheat', title: 'A Grain of Wheat', author: 'Ngũgĩ wa Thiong’o' },
    ],
  },
];

async function seed() {
  await prisma.$transaction(async (tx) => {
    for (const { genre: name, books } of catalog) {
      const genre = await tx.genre.upsert({
        where: { name },
        create: { name },
        update: { name },
      });

      for (const { id, title, author } of books) {
        const data = { title, author, genreId: genre.id };
        await tx.book.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
      }
    }
  }, { timeout: 30_000 });

  const bookCount = catalog.reduce((total, { books }) => total + books.length, 0);
  console.log(`Seeded ${bookCount} books across ${catalog.length} genres.`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
