// kyc_proof
//
// Proves the holder knows the secret behind a KYC credential without revealing
// it: knowledge of the Poseidon2 preimage of a public commitment the issuer
// signed into the credential. This is the minimal "I hold a credential the
// issuer attested" proof; richer attribute circuits (age, jurisdiction) follow
// the same commitment pattern with added public claims.
//
// Uses the same Poseidon2 hash and proving stack as the reference verifier
// (Noir 1.0.0-beta.9 / bb v0.87.0), so a VK from this circuit verifies on-chain.

use dep::poseidon::poseidon2::Poseidon2;

fn main(preimage: Field, hash: pub Field) {
    let computed = Poseidon2::hash([preimage], 1);
    assert(computed == hash);
}

#[test]
fn proves_preimage() {
    let preimage: Field = 42;
    let hash = Poseidon2::hash([preimage], 1);
    main(preimage, hash);
}
