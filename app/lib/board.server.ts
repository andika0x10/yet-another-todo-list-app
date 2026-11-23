/** Tells every open device that the card list changed. A failure here must not fail the change itself. */
export async function notifyBoard(env: Env, from: string): Promise<void> {
  try {
    await env.BOARD.get(env.BOARD.idFromName("main")).notify(from);
  } catch (error) {
    console.error("Failed to broadcast board change", error);
  }
}
