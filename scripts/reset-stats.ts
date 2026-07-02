import "dotenv/config";
import { db } from "../src/db/client";
import { answerTimes, attemptAnswers, questionStats, quizAttempts } from "../src/db/schema";

async function main() {
  await db.delete(attemptAnswers);
  await db.delete(quizAttempts);
  await db.delete(questionStats);
  await db.delete(answerTimes);

  console.log("Reset quiz attempts, answers, question statistics, and answer times.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
