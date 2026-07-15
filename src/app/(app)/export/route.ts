import { auth } from "@/auth";
import { getExportData, toJson, toCsv } from "@/lib/exportList";

// GET /export?format=json|csv — streams the signed-in user's whole library as a
// downloadable file. JSON is full-fidelity + re-importable; CSV is flattened.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const params = new URL(req.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "json";
  const listId = params.get("list") || undefined;
  const data = await getExportData(session.user.id, listId);
  const date = new Date().toISOString().slice(0, 10);
  // slug the single list's title into the filename when exporting one list
  const slug = listId && data.lists[0]
    ? "-" + data.lists[0].title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
    : "";

  const [body, type, ext] =
    format === "csv"
      ? [toCsv(data), "text/csv; charset=utf-8", "csv"]
      : [toJson(data), "application/json; charset=utf-8", "json"];

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="kokoro-export${slug}-${date}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
