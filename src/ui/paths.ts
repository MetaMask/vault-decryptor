import { RABBY_EXTENSION_ID } from '../lib/vault'

export type OS = 'mac' | 'windows' | 'linux'
export type Browser = 'chrome' | 'brave' | 'edge' | 'arc'

export const BROWSER_NAMES: Record<Browser, string> = {
  chrome: 'Chrome',
  brave: 'Brave',
  edge: 'Edge',
  arc: 'Arc',
}

/** The page that shows the exact profile folder ("Profile Path"). */
export const VERSION_PAGES: Record<Browser, string> = {
  chrome: 'chrome://version',
  brave: 'brave://version',
  edge: 'edge://version',
  arc: 'chrome://version',
}

const PROFILE_DIRS: Record<OS, Partial<Record<Browser, string>>> = {
  mac: {
    chrome: '~/Library/Application Support/Google/Chrome/Default',
    brave: '~/Library/Application Support/BraveSoftware/Brave-Browser/Default',
    edge: '~/Library/Application Support/Microsoft Edge/Default',
    arc: '~/Library/Application Support/Arc/User Data/Default',
  },
  windows: {
    chrome: '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default',
    brave: '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default',
    edge: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default',
  },
  linux: {
    chrome: '~/.config/google-chrome/Default',
    brave: '~/.config/BraveSoftware/Brave-Browser/Default',
    edge: '~/.config/microsoft-edge/Default',
  },
}

export function browsersFor (os: OS): Browser[] {
  return (Object.keys(BROWSER_NAMES) as Browser[]).filter((b) => PROFILE_DIRS[os][b])
}

export function rabbyDataPath (os: OS, browser: Browser): string {
  const profile = PROFILE_DIRS[os][browser] ?? PROFILE_DIRS[os].chrome!
  const sep = os === 'windows' ? '\\' : '/'
  return [profile, 'Local Extension Settings', RABBY_EXTENSION_ID].join(sep)
}

export function detectOS (): OS {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform || navigator.platform || navigator.userAgent
  if (/win/i.test(platform)) return 'windows'
  if (/linux|x11|cros/i.test(platform) && !/android/i.test(platform)) return 'linux'
  return 'mac'
}
