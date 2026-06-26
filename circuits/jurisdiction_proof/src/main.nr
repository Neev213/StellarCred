// jurisdiction_proof
//
// Proves "my country of residence is NOT in the restricted list" without
// revealing which country it is. The country code is private and bound to the
// issued credential via commitment = Poseidon2([country_code, salt], 2). The
// restricted list is a public input set by the verifying protocol.
//
// Country codes are ISO 3166-1 numeric (US=840, IR=364, KP=408). Unused slots
// in the restricted list are 0, which never collides with a real code.

use dep::poseidon::poseidon2::Poseidon2;

global RESTRICTED_LEN: u32 = 8;

fn main(
    // private
    country_code: u64,
    salt: Field,
    // public
    commitment: pub Field,
    restricted: pub [u64; RESTRICTED_LEN],
) {
    assert(Poseidon2::hash([country_code as Field, salt], 2) == commitment);
    for i in 0..RESTRICTED_LEN {
        assert(country_code != restricted[i]);
    }
}

fn commit(value: u64, salt: Field) -> Field {
    Poseidon2::hash([value as Field, salt], 2)
}

#[test]
fn passes_for_unrestricted_country() {
    let country: u64 = 566; // Nigeria
    let salt: Field = 77;
    let restricted: [u64; RESTRICTED_LEN] = [840, 364, 408, 0, 0, 0, 0, 0];
    main(country, salt, commit(country, salt), restricted);
}

#[test(should_fail)]
fn fails_for_restricted_country() {
    let country: u64 = 840; // US, on the list
    let salt: Field = 77;
    let restricted: [u64; RESTRICTED_LEN] = [840, 364, 408, 0, 0, 0, 0, 0];
    main(country, salt, commit(country, salt), restricted);
}
