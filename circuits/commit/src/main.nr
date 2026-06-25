// commit
//
// Helper circuit used only by the issuer to compute a credential commitment:
// commitment = Poseidon2(preimage). It is executed (witness only) in the
// browser to derive the commitment, never proven. Because it uses the exact
// same Poseidon2 as kyc_proof, the resulting commitment is guaranteed to match
// what the proving circuit (and the deployed VK) expect.

use dep::poseidon::poseidon2::Poseidon2;

fn main(preimage: Field) -> pub Field {
    Poseidon2::hash([preimage], 1)
}

#[test]
fn matches_known_vector() {
    // preimage 42 -> the commitment used by the demo kyc credential.
    let h = main(42);
    assert(h == 0x255ee8299be9389b21052fd317f8cae762f9c89f756ac79262fb648a70ee7a08);
}
