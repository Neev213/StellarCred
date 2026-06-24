// age_proof
//
// Proves "I am at least `threshold_years` old" without revealing the date of
// birth, while binding the proof to a credential the issuer actually attested.
//
// The binding here uses a Pedersen commitment: the issuer publishes
// `credential_commitment = pedersen_hash(date_of_birth, salt)` inside the
// signed credential, and the holder proves knowledge of a (dob, salt) pre-image
// that also satisfies the age claim. Replacing the commitment check with a
// direct issuer-signature verification (e.g. ECDSA/Schnorr over the credential)
// is a planned hardening step (see README).
//
// Dates are encoded as days since the Unix epoch so comparisons stay in
// unsigned integers (Field has no ordering).

fn commit(value: u64, salt: Field) -> Field {
    std::hash::pedersen_hash([value as Field, salt])
}

fn main(
    // --- private inputs (never leave the holder's browser) ---
    date_of_birth: u64,
    salt: Field,
    // --- public inputs (submitted to the verifier on-chain) ---
    credential_commitment: pub Field,
    current_date: pub u64,
    threshold_years: pub u64,
) {
    // 1. Bind this proof to the issued credential.
    assert(commit(date_of_birth, salt) == credential_commitment);

    // 2. Prove the age claim.
    assert(current_date >= date_of_birth);
    let age_years = (current_date - date_of_birth) / 365;
    assert(age_years >= threshold_years);
}

#[test]
fn passes_when_old_enough() {
    // dob = epoch day 3650 (~1980), today = day 20000 (~2024): age ~44.
    let dob: u64 = 3650;
    let salt: Field = 12345;
    main(dob, salt, commit(dob, salt), 20000, 18);
}

#[test(should_fail)]
fn fails_when_too_young() {
    let dob: u64 = 19000;
    let salt: Field = 12345;
    // ~2.7 years old against an 18-year threshold.
    main(dob, salt, commit(dob, salt), 20000, 18);
}

#[test(should_fail)]
fn fails_on_wrong_commitment() {
    let dob: u64 = 3650;
    let salt: Field = 12345;
    main(dob, salt, 999, 20000, 18);
}
