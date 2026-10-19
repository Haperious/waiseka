// Base URL used to build absolute links (emails, redirects). Trailing slashes are
// stripped so `${APP_URL}/budgets` never becomes `https://host//budgets`, even if
// the APP_URL env var is set as "https://host/".
export const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
