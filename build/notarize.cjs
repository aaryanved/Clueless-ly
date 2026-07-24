// electron-builder afterSign hook. Notarizes the signed .app with Apple's service
// only when credentials are present in the environment, so ordinary local builds
// succeed without them.
//
// Required env vars for notarization:
//   APPLE_ID                     - your Apple developer account email
//   APPLE_APP_SPECIFIC_PASSWORD  - an app-specific password (appleid.apple.com)
//   APPLE_TEAM_ID                - your Apple Developer Team ID
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      '[notarize] Skipping notarization: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID to enable it.'
    )
    return
  }

  const appName = context.packager.appInfo.productFilename
  console.log(`[notarize] Notarizing ${appName}.app — this can take several minutes…`)
  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  })
  console.log('[notarize] Done.')
}
