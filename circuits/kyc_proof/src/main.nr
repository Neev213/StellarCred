// kyc_proof
//
// Proves the holder knows the secret behind a KYC credential without revealing
// it: knowledge of (secret, salt) whose Poseidon2 commitment the issuer signed
// into the credential. Same commitment shape as every other credential circuit
// (Poseidon2([value, salt], 2)), so one issuer helper covers all types.

use dep::poseidon::poseidon2::Poseidon2;

fn main(secret: Field, salt: Field, commitment: pub Field) {
    assert(Poseidon2::hash([secret, salt], 2) == commitment);
}

#[test]
fn proves_commitment() {
    let secret: Field = 42;
    let salt: Field = 7;
    main(secret, salt, Poseidon2::hash([secret, salt], 2));
}

#[test(should_fail)]
fn rejects_wrong_commitment() {
    main(42, 7, 12345);
}
