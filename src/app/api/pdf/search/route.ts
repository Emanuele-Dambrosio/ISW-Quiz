import { NextRequest, NextResponse } from "next/server";
import { getQuestionListRows } from "@/lib/quiz-data";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const rows = await getQuestionListRows({ query, limit: 12, sort: "id_asc" });

  return NextResponse.json({
    results: rows.map((row) => ({
      id: row.id,
      displayNumber: row.displayNumber,
      textPlain: row.textPlain.length > 160 ? `${row.textPlain.slice(0, 160)}...` : row.textPlain,
      categoryName: row.categoryName,
      isFlagged: row.isFlagged,
    })),
  });
}
