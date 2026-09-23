export type MobileAuthConfig = {
  clerkPublishableKey: string;
};

export async function fetchMobileAuthConfig(apiBaseUrl: string): Promise<MobileAuthConfig> {
  const endpoint = new URL('/api/auth/mobile-config', `${apiBaseUrl}/`).toString();
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Mobile authentication configuration returned HTTP ${response.status}.`);
  }

  const config = (await response.json()) as Partial<MobileAuthConfig>;
  if (
    typeof config.clerkPublishableKey !== 'string' ||
    !/^pk_(test|live)_/.test(config.clerkPublishableKey)
  ) {
    throw new Error('Mobile authentication configuration is invalid.');
  }

  return { clerkPublishableKey: config.clerkPublishableKey };
}