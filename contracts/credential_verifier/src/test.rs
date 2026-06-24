#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Bytes, Env};

fn setup(env: &Env) -> CredentialVerifierClient {
    let admin = Address::generate(env);
    let id = env.register(CredentialVerifier, (admin,));
    CredentialVerifierClient::new(env, &id)
}

#[test]
fn verifies_when_vk_set_and_inputs_present() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    client.set_vk(&symbol_short!("kyc"), &Bytes::from_array(&env, &[1, 2, 3]));

    let proof = Bytes::from_array(&env, &[9u8; 8]);
    let public_inputs = Bytes::from_array(&env, &[4u8; 32]);
    assert!(client.verify_kyc_proof(&proof, &public_inputs));
}

#[test]
fn rejects_empty_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);

    client.set_vk(&symbol_short!("kyc"), &Bytes::from_array(&env, &[1]));
    let empty = Bytes::new(&env);
    let public_inputs = Bytes::from_array(&env, &[4u8; 32]);
    assert!(!client.verify_kyc_proof(&empty, &public_inputs));
}

#[test]
#[should_panic]
fn panics_without_vk() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let proof = Bytes::from_array(&env, &[9u8; 8]);
    let public_inputs = Bytes::from_array(&env, &[4u8; 32]);
    client.verify_age_proof(&proof, &public_inputs);
}
