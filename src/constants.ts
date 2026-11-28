/**
 * DSBmobile API constants
 */

/** Base URL for the DSBmobile Mobile API */
export const DSB_API_BASE_URL = 'https://mobileapi.dsbcontrol.de';

/** Bundle ID used to identify the DSBmobile app */
export const DSB_BUNDLE_ID = 'de.heinekingmedia.dsbmobile';

/** DSBmobile app version to report */
export const DSB_APP_VERSION = '35';

/** OS version to report (Android API level) */
export const DSB_OS_VERSION = '22';

/** Request timeout in milliseconds */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum response size in characters before truncation */
export const CHARACTER_LIMIT = 25_000;

/** Environment variable name for DSBmobile username */
export const ENV_USERNAME = 'DSB_USERNAME';

/** Environment variable name for DSBmobile password */
export const ENV_PASSWORD = 'DSB_PASSWORD';

/** Environment variable name for the default class filter */
export const ENV_CLASS = 'DSB_CLASS';
