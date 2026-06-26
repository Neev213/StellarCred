// commit
//
// Helper circuit used only by the issuer to compute a credential commitment:
// commitment = Poseidon2([value, salt], 2). Executed (witness only) in the
// browser to derive the commitment, never proven. Every credential circuit
// binds to a commitment of this exact shape, so the issuer can use this one
// helper for all credential types.

use dep::poseidon::poseidon2::Poseidon2;

fn main(value: Field, salt: Field) -> pub Field {
    Poseidon2::hash([value, salt], 2)
}
