import "dotenv/config";
import { db } from "../src/db/client";
import { attemptAnswers, questionStats, quizAttempts } from "../src/db/schema";

async function main() {
  await db.delete(attemptAnswers);
  await db.delete(quizAttempts);
  await db.delete(questionStats);

  console.log("Reset quiz attempts, answers, and question statistics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
