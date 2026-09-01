import { prisma } from '../db/client';

async function main() {
  const [userId, authSubject] = process.argv.slice(2);
  if (!userId || !authSubject) {
    throw new Error('Usage: npm run auth:link-existing -- <caloriebank-user-uuid> <clerk-user-id>');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('CalorieBank user was not found.');
  if (user.authSubject && user.authSubject !== authSubject) {
    throw new Error('CalorieBank user is already linked to another authentication identity.');
  }

  const existingIdentity = await prisma.user.findUnique({ where: { authSubject } });
  if (existingIdentity && existingIdentity.id !== userId) {
    throw new Error('Authentication identity is already linked to another CalorieBank user.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { authProvider: 'clerk', authSubject },
  });
  console.info(`Linked CalorieBank user ${userId} to the supplied Clerk identity.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Identity link failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
