#![cfg(test)]

use super::*;
use credential_verifier::{CredentialVerifier, CredentialVerifierClient};
use issuer_registry::{IssuerRegistry, IssuerRegistryClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger as _},
    vec, Address, BytesN, Bytes, Env,
};

// Real UltraHonk artifacts (kyc_proof circuit, Noir beta.9 + bb 0.87.0), so
// submit_proof exercises genuine on-chain verification through the verifier.
const VK: &[u8] = include_bytes!("../../../fixtures/kyc/vk");
const PROOF: &[u8] = include_bytes!("../../../fixtures/kyc/proof");
const PUBLIC_INPUTS: &[u8] = include_bytes!("../../../fixtures/kyc/public_inputs");

// The issuer secp256k1 key (x || y) the fixtures were signed with, read straight
// out of the proof's public inputs (fields 1..65, low byte of each 32-byte
// field) so the registered key always matches what the proof attests to.
fn demo_pubkey(env: &Env) -> BytesN<64> {
    let mut arr = [0u8; 64];
    for i in 0..64usize {
        arr[i] = PUBLIC_INPUTS[(1 + i) * 32 + 31];
    }
    BytesN::from_array(env, &arr)
}

struct Harness {
    registry: ProofRegistryClient<'static>,
    issuer: Address,
}

fn deploy(env: &Env) -> Harness {
    let admin = Address::generate(env);

    // IssuerRegistry with one issuer trusted for kyc.
    let ir_id = env.register(IssuerRegistry, (admin.clone(),));
    let ir = IssuerRegistryClient::new(env, &ir_id);
    let issuer = Address::generate(env);
    ir.register_issuer(
        &issuer,
        &demo_pubkey(env),
        &vec![env, symbol_short!("kyc")],
    );

    // CredentialVerifier with the kyc VK.
    let v_id = env.register(CredentialVerifier, (admin,));
    CredentialVerifierClient::new(env, &v_id)
        .set_vk(&symbol_short!("kyc"), &Bytes::from_slice(env, VK));

    let pr_id = env.register(ProofRegistry, (v_id, ir_id));
    Harness {
        registry: ProofRegistryClient::new(env, &pr_id),
        issuer,
    }
}

fn submit(env: &Env, h: &Harness, holder: &Address, expiry: u64) {
    h.registry.submit_proof(
        holder,
        &h.issuer,
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
fn expires_after_ledger_time_passes() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let holder = Address::generate(&env);

    submit(&env, &h, &holder, 1000); // valid until ts=1000
    assert!(h.registry.is_verified(&holder, &symbol_short!("kyc")).0);

    // Advance ledger time past the expiry.
    env.ledger().with_mut(|li| li.timestamp = 2000);
    assert!(!h.registry.is_verified(&holder, &symbol_short!("kyc")).0);
}

#[test]
fn rejects_wrong_issuer_key() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    // Register the issuer with a DIFFERENT key than the one the proof was signed
    // with, so the public-input pubkey will not match.
    let ir_id = env.register(IssuerRegistry, (admin.clone(),));
    let issuer = Address::generate(&env);
    IssuerRegistryClient::new(&env, &ir_id).register_issuer(
        &issuer,
        &BytesN::from_array(&env, &[3u8; 64]),
        &vec![&env, symbol_short!("kyc")],
    );
    let v_id = env.register(CredentialVerifier, (admin,));
    CredentialVerifierClient::new(&env, &v_id)
        .set_vk(&symbol_short!("kyc"), &Bytes::from_slice(&env, VK));
    let pr_id = env.register(ProofRegistry, (v_id, ir_id));
    let registry = ProofRegistryClient::new(&env, &pr_id);

    let holder = Address::generate(&env);
    let res = registry.try_submit_proof(
        &holder,
        &issuer,
        &symbol_short!("kyc"),
        &Bytes::from_slice(&env, PROOF),
        &Bytes::from_slice(&env, PUBLIC_INPUTS),
        &1000,
    );
    assert!(res.is_err());
    assert!(!registry.is_verified(&holder, &symbol_short!("kyc")).0);
}

#[test]
fn rejects_untrusted_issuer() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let holder = Address::generate(&env);
    let stranger = Address::generate(&env); // not registered

    let res = h.registry.try_submit_proof(
        &holder,
        &stranger,
        &symbol_short!("kyc"),
        &Bytes::from_slice(&env, PROOF),
        &Bytes::from_slice(&env, PUBLIC_INPUTS),
        &1000,
    );
    assert!(res.is_err());
    assert!(!h.registry.is_verified(&holder, &symbol_short!("kyc")).0);
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
        &h.issuer,
        &symbol_short!("kyc"),
        &Bytes::from_slice(&env, &bad),
        &Bytes::from_slice(&env, PUBLIC_INPUTS),
        &1000,
    );
    assert!(res.is_err());
    assert!(!h.registry.is_verified(&holder, &symbol_short!("kyc")).0);
}

#[test]
fn unverified_holder_returns_false() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let stranger = Address::generate(&env);
    assert!(!h.registry.is_verified(&stranger, &symbol_short!("kyc")).0);
}

#[test]
fn revoke_clears_proof() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let holder = Address::generate(&env);

    submit(&env, &h, &holder, 1000);
    h.registry.revoke_proof(&holder, &symbol_short!("kyc"));
    assert!(!h.registry.is_verified(&holder, &symbol_short!("kyc")).0);
}
