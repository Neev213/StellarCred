#![cfg(test)]

use super::*;
use credential_verifier::{CredentialVerifier, CredentialVerifierClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Bytes, Env};

struct Harness {
    registry: ProofRegistryClient<'static>,
}

fn deploy(env: &Env) -> Harness {
    let admin = Address::generate(env);
    let verifier_id = env.register(CredentialVerifier, (admin,));
    let verifier = CredentialVerifierClient::new(env, &verifier_id);
    verifier.set_vk(&symbol_short!("kyc"), &Bytes::from_array(env, &[1, 2, 3]));

    let registry_id = env.register(ProofRegistry, (verifier_id,));
    Harness {
        registry: ProofRegistryClient::new(env, &registry_id),
    }
}

#[test]
fn submit_then_verified() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);

    let holder = Address::generate(&env);
    let proof = Bytes::from_array(&env, &[7u8; 16]);
    let public_inputs = Bytes::from_array(&env, &[4u8; 32]);

    h.registry
        .submit_proof(&holder, &symbol_short!("kyc"), &proof, &public_inputs, &1000);

    let (valid, _at, expiry) = h.registry.is_verified(&holder, &symbol_short!("kyc"));
    assert!(valid);
    assert_eq!(expiry, 1000);
}

#[test]
fn unverified_holder_returns_false() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let stranger = Address::generate(&env);
    let (valid, _, _) = h.registry.is_verified(&stranger, &symbol_short!("kyc"));
    assert!(!valid);
}

#[test]
fn revoke_clears_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);

    let holder = Address::generate(&env);
    let proof = Bytes::from_array(&env, &[7u8; 16]);
    let public_inputs = Bytes::from_array(&env, &[4u8; 32]);
    h.registry
        .submit_proof(&holder, &symbol_short!("kyc"), &proof, &public_inputs, &1000);

    h.registry.revoke_proof(&holder, &symbol_short!("kyc"));
    let (valid, _, _) = h.registry.is_verified(&holder, &symbol_short!("kyc"));
    assert!(!valid);
}
