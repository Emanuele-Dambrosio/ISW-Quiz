import { AppHeader, AppShell } from "@/components/AppShell";
import { SettingsManager } from "@/components/SettingsManager";
import { getAllCategoriesWithCounts } from "@/lib/quiz-data";
import { getExamSecondsLimit, MAX_EXAM_SECONDS, MIN_EXAM_SECONDS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [categories, examSecondsLimit] = await Promise.all([
    getAllCategoriesWithCounts(),
    getExamSecondsLimit(),
  ]);

  return (
    <AppShell>
      <AppHeader title="Impostazioni" />
      <div className="px-5 py-5 md:px-8">
        <SettingsManager
          categories={categories}
          examSecondsLimit={examSecondsLimit}
          minSeconds={MIN_EXAM_SECONDS}
          maxSeconds={MAX_EXAM_SECONDS}
        />
      </div>
    </AppShell>
  );
}
