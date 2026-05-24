export function isPremium(user: { tier: string; premiumOverride: boolean }): boolean {
  return user.tier === 'premium' || user.premiumOverride === true
}
