// income_proof
//
// Proves "my income is at least `threshold`" without revealing the actual
// figure. The issuer commits to the income: commitment = Poseidon2([income,
// salt], 2). The threshold is a public input set by the verifying protocol, so
// the same credential proves "> $200k" or "> $10k" depending on the gate.

use dep::poseidon::poseidon2::Poseidon2;

fn main(
    // private
    income: u64,
    salt: Field,
    // public
    commitment: pub Field,
    threshold: pub u64,
) {
    assert(Poseidon2::hash([income as Field, salt], 2) == commitment);
    assert(income >= threshold);
}

fn commit(value: u64, salt: Field) -> Field {
    Poseidon2::hash([value as Field, salt], 2)
}

#[test]
fn passes_when_above_threshold() {
    let income: u64 = 250000;
    let salt: Field = 99;
    main(income, salt, commit(income, salt), 200000);
}

#[test(should_fail)]
fn fails_when_below_threshold() {
    let income: u64 = 50000;
    let salt: Field = 99;
    main(income, salt, commit(income, salt), 200000);
}
