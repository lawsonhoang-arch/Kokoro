import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";

// Serves an uploaded image (admin news covers) as binary. The id is unique per
// upload and the bytes never change, so it's immutably cacheable.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ mime: uploads.mime, bytes: uploads.bytes })
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  // Buffer is a Uint8Array, a valid Response body
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
