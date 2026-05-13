/**
 * cmux-notify — OpenCode plugin for cmux notification ring integration
 *
 * Fires cmux notify when OpenCode pauses for input or needs a permission
 * decision, triggering the blue pane ring and sidebar badge in cmux.
 *
 * Safe to leave enabled outside cmux — all calls are gated on CMUX_SOCKET_PATH.
 */
export const CmuxNotify = async ({ $ }) => {
  const inCmux = () => !!process.env.CMUX_SOCKET_PATH

  return {
    event: async ({ event }) => {
      if (!inCmux()) return

      if (event.type === "session.idle") {
        await $`cmux notify --title "OpenCode" --body "Waiting for input"`.quiet()
      }

      if (event.type === "session.error") {
        await $`cmux notify --title "OpenCode" --subtitle "Error" --body "Session encountered an error"`.quiet()
      }
    },

    "permission.asked": async (input) => {
      if (!inCmux()) return
      const tool = input?.tool ?? "tool"
      await $`cmux notify --title "OpenCode" --subtitle "Permission required" --body ${`Approve ${tool}?`}`.quiet()
    },
  }
}
