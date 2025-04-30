import { getPreferences } from '@/actions/config';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  const locale = await getPreferences({})
    .then(res => res.data?.language || 'en')
    .catch(() => 'en');

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
