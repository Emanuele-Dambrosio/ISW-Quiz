import { AppHeader, AppShell } from "@/components/AppShell";
import { TrainingRunner } from "@/components/TrainingRunner";
import { getRandomTrainingQuestion } from "@/lib/quiz-data";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const question = await getRandomTrainingQuestion();

  return (
    <AppShell>
      <AppHeader title="Allenamento" />
      <div className="px-5 py-5 md:px-8">
        <TrainingRunner initialQuestion={question} />
      </div>
    </AppShell>
  );
}
