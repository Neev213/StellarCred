#![no_std]
//! CredentialVerifier
//!
//! Stateless cryptographic gateway. One `verify_*` function per credential type;
//! each looks up the verification key for its circuit and checks an UltraHonk
//! proof against the supplied public inputs using the host-native BN254 verifier
//! from `ultrahonk_soroban_verifier`. It stores no per-holder state and returns
//! only a boolean.
//!
//! Verification keys are set by an admin (one VK per credential circuit). Each VK
//! is tied to a specific Noir circuit and must be produced with the same `bb`
//! version used to generate proofs (Barretenberg v0.87.0 / Noir 1.0.0-beta.9).
//! `proof` and `public_inputs` are the opaque byte blobs emitted by `bb`.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Bytes, Env, Symbol,
};
use ultrahonk_soroban_verifier::{UltraHonkVerifier, PROOF_BYTES};

// Persistent-entry lifetime management (~5s ledgers). VKs are long-lived.
const DAY_IN_LEDGERS: u32 = 17280;
const VK_BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const VK_TTL: u32 = 180 * DAY_IN_LEDGERS;

#[contracttype]
pub enum DataKey {
    Admin,
    /// Verification key bytes, keyed by credential-type symbol.
    Vk(Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    VkNotSet = 2,
    VkInvalid = 3,
}

#[contract]
pub struct CredentialVerifier;

#[contractimpl]
impl CredentialVerifier {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Register/replace the verification key for a credential circuit. Admin-only.
    /// The VK is validated by parsing it before storage, rejecting malformed keys
    /// at set time.
    pub fn set_vk(env: Env, credential_type: Symbol, vk: Bytes) {
        Self::require_admin(&env);
        if UltraHonkVerifier::new(&env, &vk).is_err() {
            panic_with_error!(&env, Error::VkInvalid);
        }
        let key = DataKey::Vk(credential_type);
        env.storage().persistent().set(&key, &vk);
        env.storage()
            .persistent()
            .extend_ttl(&key, VK_BUMP_THRESHOLD, VK_TTL);
    }

    pub fn verify_kyc_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        Self::verify(&env, symbol_short!("kyc"), &proof, &public_inputs)
    }

    pub fn verify_age_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        Self::verify(&env, symbol_short!("age"), &proof, &public_inputs)
    }

    pub fn verify_jurisdiction_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        Self::verify(&env, Symbol::new(&env, "jurisdiction"), &proof, &public_inputs)
    }

    pub fn verify_income_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        Self::verify(&env, symbol_short!("income"), &proof, &public_inputs)
    }

    fn verify(env: &Env, credential_type: Symbol, proof: &Bytes, public_inputs: &Bytes) -> bool {
        // Proofs are fixed-length; reject early before touching the verifier.
        if proof.len() as usize != PROOF_BYTES {
            return false;
        }
        let vk: Bytes = env
            .storage()
            .persistent()
            .get(&DataKey::Vk(credential_type))
            .unwrap_or_else(|| panic_with_error!(env, Error::VkNotSet));

        match UltraHonkVerifier::new(env, &vk) {
            Ok(verifier) => verifier.verify(env, proof, public_inputs).is_ok(),
            Err(_) => false,
        }
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        admin.require_auth();
    }
}

mod test;
