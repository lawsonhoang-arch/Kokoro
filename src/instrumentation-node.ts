// Node.js-only: keep the server alive on transient DB rejections. A
// pooled/Supabase DB can surface a query rejection that isn't tied to an awaited
// call — e.g. a statement cancelled after a client disconnect, or a reused
// pooler backend erroring. Node's default is to CRASH the whole server on such
// an unhandled rejection; that's too blunt for a transient DB hiccup, so we log
// it and keep serving. Genuinely unexpected rejections are logged loudly.
process.on("unhandledRejection", (reason: unknown) => {
  const e = reason as { code?: string; severity?: string; name?: string; message?: string } | null;
  const isPgError =
    !!e &&
    (e.name === "PostgresError" ||
      typeof e.severity === "string" || // postgres.js attaches severity
      (typeof e.code === "string" && /^\d{5}$/.test(e.code))); // SQLSTATE
  if (isPgError) {
    console.warn(`[db] swallowed unhandled rejection (${e?.code ?? "?"}): ${e?.message ?? reason}`);
    return;
  }
  console.error("⚠ Unhandled rejection (kept process alive):", reason);
});

export {}; // side-effect module
