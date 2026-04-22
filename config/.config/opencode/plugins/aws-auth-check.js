/**
 * aws-auth-check — OpenCode plugin for Flexion AWS credential monitoring
 *
 * Checks AWS SSO credential expiry on each session idle and warns
 * via console (and cmux notification if running inside cmux) when
 * credentials are about to expire or have expired.
 *
 * Auth before launch is handled by the flexion-opencode() shell function.
 * Profile-based auth is baked into opencode.json provider config.
 * This plugin covers the mid-session expiry case.
 *
 * Safe to leave enabled in any environment — cmux notifications are
 * gated on CMUX_SOCKET_PATH, and all AWS calls are gated on aws CLI presence.
 */
export const FlexionAwsAuthCheck = async ({ $ }) => {
  const PROFILE = "ClaudeCodeAccess-FlexionLLM"
  const WARN_THRESHOLD_SECS = 30 * 60  // warn at 30 minutes remaining
  const CHECK_INTERVAL_MS = 5 * 60 * 1000  // only check every 5 minutes

  const inCmux = () => !!process.env.CMUX_SOCKET_PATH

  let lastCheckMs = 0
  let lastWarnedExpiry = null  // deduplicate warnings for the same token

  async function getExpiryInfo() {
    try {
      const result = await $`aws configure export-credentials --profile ${PROFILE} --format process`.quiet()
      const creds = JSON.parse(result.stdout)
      if (!creds.Expiration) return null
      const expiresAt = new Date(creds.Expiration)
      const remainingSecs = (expiresAt.getTime() - Date.now()) / 1000
      return { expiresAt, remainingSecs }
    } catch {
      return null  // aws not installed, profile missing, or no active session
    }
  }

  async function notifyIfNeeded({ expiresAt, remainingSecs }) {
    const expiryKey = expiresAt.toISOString()
    if (lastWarnedExpiry === expiryKey) return  // already warned for this token

    if (remainingSecs < 0) {
      lastWarnedExpiry = expiryKey
      const msg = "⚠️  AWS credentials have expired! Run: aws sso login --profile " + PROFILE
      console.warn("\n" + msg)
      if (inCmux()) {
        try {
          await $`cmux notify --title "OpenCode" --subtitle "AWS Auth Expired" --body ${msg}`.quiet()
        } catch {}
      }
    } else if (remainingSecs < WARN_THRESHOLD_SECS) {
      lastWarnedExpiry = expiryKey
      const remainingMins = Math.floor(remainingSecs / 60)
      const timeStr = expiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      const msg = `⚠️  AWS credentials expire in ${remainingMins} min (at ${timeStr}). Run: aws sso login --profile ${PROFILE}`
      console.warn("\n" + msg)
      if (inCmux()) {
        try {
          await $`cmux notify --title "OpenCode" --subtitle "AWS Token Expiring" --body ${msg}`.quiet()
        } catch {}
      }
    }
  }

  async function checkCredentials() {
    const now = Date.now()
    if (now - lastCheckMs < CHECK_INTERVAL_MS) return
    lastCheckMs = now

    const info = await getExpiryInfo()
    if (!info) return
    await notifyIfNeeded(info)
  }

  return {
    event: async ({ event }) => {
      // session.idle fires each time the model finishes and waits for input
      if (event.type === "session.idle") {
        await checkCredentials()
      }
    },
  }
}
