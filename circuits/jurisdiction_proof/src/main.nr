// jurisdiction_proof
//
// Proves "my country of residence is NOT in the restricted list" without
// revealing which country it is. The restricted list is a public input set by
// the verifying protocol; the country code is private and bound to the issued
// credential via a Pedersen commitment (see age_proof for the commitment
// rationale and the planned move to signature verification).
//
// Country codes are ISO 3166-1 numeric (e.g. US=840, IR=364, KP=408). The
// restricted list is fixed-length; unused slots are 0, which never collides
// with a real code.

global RESTRICTED_LEN: u32 = 8;

fn commit(value: u64, salt: Field) -> Field {
    std::hash::pedersen_hash([value as Field, salt])
}

fn main(
    // --- private inputs ---
    country_code: u64,
    salt: Field,
    // --- public inputs ---
    credential_commitment: pub Field,
    restricted: pub [u64; RESTRICTED_LEN],
) {
    // 1. Bind this proof to the issued credential.
    assert(commit(country_code, salt) == credential_commitment);

    // 2. Prove non-membership: country differs from every restricted entry.
    for i in 0..RESTRICTED_LEN {
        assert(country_code != restricted[i]);
    }
}

#[test]
fn passes_for_unrestricted_country() {
    let country: u64 = 566; // Nigeria
    let salt: Field = 777;
    let restricted: [u64; RESTRICTED_LEN] = [840, 364, 408, 0, 0, 0, 0, 0];
    main(country, salt, commit(country, salt), restricted);
}

#[test(should_fail)]
fn fails_for_restricted_country() {
    let country: u64 = 840; // US, on the list
    let salt: Field = 777;
    let restricted: [u64; RESTRICTED_LEN] = [840, 364, 408, 0, 0, 0, 0, 0];
    main(country, salt, commit(country, salt), restricted);
}
