export const legalPolicy = {
  termsVersion: '2026-09-21',
  privacyVersion: '2026-09-21',
  aiNoticeVersion: '2026-09-21',
  effectiveDate: '2026년 9월 21일',
} as const;

export const legalContact = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || '';
export const geminiDataTier = process.env.NEXT_PUBLIC_GEMINI_DATA_TIER === 'paid' ? 'paid' : 'unpaid';
