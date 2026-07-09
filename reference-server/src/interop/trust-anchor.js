// Epic 21 — Trust Anchor / regulated-DeFi access profile (Project Guardian model).
//
// Messaging-layer only. A regulated bank/VASP (the "trust anchor") issues an
// access credential built from pacs.crypto identity data; a permissioned pool
// verifies eligibility before allowing participation. This module asserts
// ELIGIBLE / NOT_ELIGIBLE and carries identity — it NEVER communicates sanctions
// findings or performs on-chain compliance adjudication, consistent with the
// family's anti-tipping-off discipline. `screening_completed` is a boolean
// readiness flag only; the *reason* a screen failed is deliberately never
// represented.

export function buildAccessCredential(subject = {}, options = {}) {
  const warnings = [];
  if (!subject.lei && !subject.vlei_credential) {
    warnings.push('subject has neither LEI nor vLEI; organisational identity is weakly bound');
  }

  const identityBound = Boolean(subject.lei || subject.vlei_credential);
  // `eligibility` is the trust anchor's vouch (cleared to participate), not a
  // disclosure of a screening result: NOT_ELIGIBLE is deliberately ambiguous
  // (missing identity OR not yet attested) and never carries a reason.
  const eligible = Boolean(subject.name && identityBound && subject.screening_completed === true);

  return {
    credential: {
      credential_type: 'POOL_ACCESS',
      subject: {
        name: subject.name ?? null,
        lei: subject.lei ?? null,
        vlei_credential: subject.vlei_credential ?? null,
        wallet: subject.wallet ?? null,
      },
      issuer: options.issuer ?? null,
      scope: options.scope ?? ['POOL_ACCESS'],
      // The only compliance signal is a boolean readiness flag — no AML/sanctions
      // reasoning is ever attached.
      eligibility: eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      issued_at: options.issued_at ?? null,
      expires_at: options.expires_at ?? null,
    },
    warnings,
  };
}

export function verifyAccessCredential(credential = {}, policy = {}) {
  const reasons = [];

  if (credential.eligibility !== 'ELIGIBLE') {
    reasons.push('credential is not marked eligible');
  }
  if (policy.required_scope && !(credential.scope ?? []).includes(policy.required_scope)) {
    reasons.push('credential scope does not include the required scope');
  }
  if (policy.require_vlei && !credential.subject?.vlei_credential) {
    reasons.push('policy requires a vLEI-bound subject');
  }
  const parsedNow = policy.now ? Date.parse(policy.now) : Date.now();
  const now = Number.isNaN(parsedNow) ? Date.now() : parsedNow;
  if (credential.expires_at) {
    const expiresAt = Date.parse(credential.expires_at);
    // Fail closed: a malformed expiry is treated as expired, not never-expiring.
    if (Number.isNaN(expiresAt) || expiresAt < now) {
      reasons.push('credential has expired or has an invalid expiry');
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
