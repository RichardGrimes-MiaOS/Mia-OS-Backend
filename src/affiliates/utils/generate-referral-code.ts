/**
 * Generate a random 8-character alphanumeric referral code (uppercase)
 * Characters: A-Z, 0-9
 * Example: "XJ4K9P2A"
 */
export function generateReferralCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
}
