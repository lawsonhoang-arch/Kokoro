// Runs once when a server instance starts (Next.js instrumentation hook).
export async function register() {
  // The rejection handler uses `process.on`, which the Edge runtime lacks — load
  // it only in the Node.js runtime via a dynamic import so it's never bundled
  // for Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
