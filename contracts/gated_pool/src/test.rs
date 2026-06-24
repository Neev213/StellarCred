#![cfg(test)]

use super::*;
use credential_verifier::{CredentialVerifier, CredentialVerifierClient};
use proof_registry::{ProofRegistry, ProofRegistryClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Bytes, Env};

struct Harness {
    registry: ProofRegistryClient<'static>,
    pool: GatedPoolClient<'static>,
}

fn deploy(env: &Env) -> Harness {
    let admin = Address::generate(env);
    let verifier_id = env.register(CredentialVerifier, (admin,));
    CredentialVerifierClient::new(env, &verifier_id)
        .set_vk(&symbol_short!("kyc"), &Bytes::from_array(env, &[1, 2, 3]));

    let registry_id = env.register(ProofRegistry, (verifier_id,));
    let pool_id = env.register(GatedPool, (registry_id.clone(),));

    Harness {
        registry: ProofRegistryClient::new(env, &registry_id),
        pool: GatedPoolClient::new(env, &pool_id),
    }
}

fn prove_kyc(env: &Env, registry: &ProofRegistryClient, holder: &Address) {
    let proof = Bytes::from_array(env, &[7u8; 16]);
    let public_inputs = Bytes::from_array(env, &[4u8; 32]);
    registry.submit_proof(holder, &symbol_short!("kyc"), &proof, &public_inputs, &1_000_000);
}

#[test]
fn deposit_blocked_without_kyc() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let user = Address::generate(&env);

    let res = h.pool.try_deposit(&user, &100);
    assert!(res.is_err());
    assert_eq!(h.pool.get_balance(&user), 0);
}

#[test]
fn deposit_allowed_after_kyc() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let user = Address::generate(&env);

    prove_kyc(&env, &h.registry, &user);
    h.pool.deposit(&user, &100);
    assert_eq!(h.pool.get_balance(&user), 100);
}

#[test]
fn withdraw_is_open() {
    let env = Env::default();
    env.mock_all_auths();
    let h = deploy(&env);
    let user = Address::generate(&env);

    prove_kyc(&env, &h.registry, &user);
    h.pool.deposit(&user, &100);
    h.pool.withdraw(&user, &40);
    assert_eq!(h.pool.get_balance(&user), 60);
}
