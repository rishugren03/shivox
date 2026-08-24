import { prisma } from '../config/prisma';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: npx ts-node src/scripts/addCompany.ts "<Company Name>" <greenhouse|lever|ashby> <board_token_or_slug>');
    process.exit(1);
  }

  const [name, atsType, boardTokenOrSlug] = args;
  const validAts = ['greenhouse', 'lever', 'ashby'];
  if (!validAts.includes(atsType.toLowerCase())) {
    console.error(`Invalid ATS type: ${atsType}. Must be one of: ${validAts.join(', ')}`);
    process.exit(1);
  }

  const existing = await prisma.company.findFirst({
    where: {
      atsType: atsType.toLowerCase(),
      boardTokenOrSlug,
    },
  });

  if (existing) {
    console.log(`Company already exists: ${existing.name} (${existing.id})`);
    return;
  }

  const company = await prisma.company.create({
    data: {
      name,
      atsType: atsType.toLowerCase(),
      boardTokenOrSlug,
      active: true,
    },
  });

  console.log(`Successfully added company: ${company.name} [${company.atsType}] -> ${company.boardTokenOrSlug}`);
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
