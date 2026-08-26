/**
 * Next.js Instrumentation Hook: wird einmalig beim Serverstart ausgeführt.
 * Der eigentliche Start der Hintergrunddienste liegt in `instrumentation-node.ts`,
 * damit die Edge-Runtime die Node-Module gar nicht erst einbindet.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNodeInstrumentation } = await import('./instrumentation-node');
    await registerNodeInstrumentation();
  }
}
