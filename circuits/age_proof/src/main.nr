// age_proof
//
// Proves "I am at least `threshold_years` old" without revealing the date of
// birth, bound to a credential the issuer attested. The issuer commits to the
// date of birth: commitment = Poseidon2([date_of_birth, salt], 2). Dates are
// days since the Unix epoch so comparisons stay in unsigned integers.

use dep::poseidon::poseidon2::Poseidon2;

fn main(
    // private
    date_of_birth: u64,
    salt: Field,
    // public
    commitment: pub Field,
    current_date: pub u64,
    threshold_years: pub u64,
) {
    assert(Poseidon2::hash([date_of_birth as Field, salt], 2) == commitment);
    assert(current_date >= date_of_birth);
    let age_years = (current_date - date_of_birth) / 365;
    assert(age_years >= threshold_years);
}

fn commit(value: u64, salt: Field) -> Field {
    Poseidon2::hash([value as Field, salt], 2)
}

#[test]
fn passes_when_old_enough() {
    let dob: u64 = 3650;
    let salt: Field = 12345;
    main(dob, salt, commit(dob, salt), 20000, 18);
}

#[test(should_fail)]
fn fails_when_too_young() {
    let dob: u64 = 19000;
    let salt: Field = 12345;
    main(dob, salt, commit(dob, salt), 20000, 18);
}

#[test(should_fail)]
fn fails_on_wrong_commitment() {
    main(3650, 12345, 999, 20000, 18);
}
