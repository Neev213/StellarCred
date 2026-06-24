#![cfg(test)]

use super::*;
use credential_verifier::{CredentialVerifier, CredentialVerifierClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Bytes, Env};

// Real UltraHonk artifacts (kyc_proof circuit, Noir beta.9 + bb 0.87.0), so
// submit_proof exercises genuine on-chain verification through the verifier.
const VK: &[u8] = include_bytes!("../../../fixtures/kyc/vk");
const PROOF: &[u8] = include_bytes!("../../../fixtures/kyc/proof");
const PUBLIC_INPUTS: &[u8] = include_bytes!("../../../fixtures/kyc/public_inputs");

struct Harness {
    registry: ProofRegistryClient<'static>,
}

fn deploy(env: &Env) -> Harness {
    let admin = Address::generate(env);
    let verifier_id = env.register(CredentialVerifier, (admin,));
    let verifier = CredentialVerifierClient::new(env, &verifier_id);
    verifier.set_vk(&symbol_short!("kyc"), &Bytes::from_slice(env, VK));

    let registry_id = env.register(ProofRegistry, (verifier_id,));
    Harness {
        registry: ProofRegistryClient::new(env, &registry_id),
    }
}

fn submit(env: &Env, h: &Harness, holder: &Address, expiry: u64) {
    h.registry.submit_proof(
        holder,
        &symbol_short!("kyc"),
        &Bytes::from_slice(env, PROOF),
        &Bytes::from_slice(env, PUBLIC_INPUTS),
        &expiry,
    );
}

#[test]
fn submit_then_verified() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let holder = Address::generate(&env);

    submit(&env, &h, &holder, 1000);

    let (valid, _at, expiry) = h.registry.is_verified(&holder, &symbol_short!("kyc"));
    assert!(valid);
    assert_eq!(expiry, 1000);
}

#[test]
fn rejects_invalid_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let holder = Address::generate(&env);

    let mut bad = PROOF.to_vec();
    bad[5000] ^= 0xff;
    let res = h.registry.try_submit_proof(
        &holder,
        &symbol_short!("kyc"),
        &Bytes::from_slice(&env, &bad),
        &Bytes::from_slice(&env, PUBLIC_INPUTS),
        &1000,
    );
    assert!(res.is_err());
    let (valid, _, _) = h.registry.is_verified(&holder, &symbol_short!("kyc"));
    assert!(!valid);
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

    submit(&env, &h, &holder, 1000);
    h.registry.revoke_proof(&holder, &symbol_short!("kyc"));

    let (valid, _, _) = h.registry.is_verified(&holder, &symbol_short!("kyc"));
    assert!(!valid);
}
