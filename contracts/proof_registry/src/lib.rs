#![no_std]
//! ProofRegistry
//!
//! Caches successful verifications so protocols don't re-run the (expensive)
//! UltraHonk verifier on every interaction. A holder proves once; the registry
//! records "this address satisfies credential X until ledger time T". Any gated
//! protocol then makes a single cheap `is_verified` call.
//!
//! On `submit_proof` the registry (1) checks the named issuer is registered and
//! trusted for the credential type via IssuerRegistry, (2) forwards the proof to
//! CredentialVerifier, and only caches the result if both pass.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, Bytes, Env, Symbol,
};

// Persistent-entry lifetime management (~5s ledgers).
const DAY_IN_LEDGERS: u32 = 17280;
const PROOF_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const PROOF_TTL: u32 = 90 * DAY_IN_LEDGERS;

/// Typed client for the deployed CredentialVerifier contract. Declared as an
/// interface (not a crate dependency) so this contract links only the client,
/// never the verifier's exported wasm symbols.
#[contractclient(name = "VerifierClient")]
pub trait VerifierInterface {
    fn verify_kyc_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool;
    fn verify_age_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool;
    fn verify_jurisdiction_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool;
    fn verify_income_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool;
}

/// Typed client for the deployed IssuerRegistry contract.
#[contractclient(name = "IssuerClient")]
pub trait IssuerRegistryInterface {
    fn is_valid_issuer(env: Env, issuer_id: Address, credential_type: Symbol) -> bool;
}

#[contracttype]
#[derive(Clone)]
pub struct ProofRecord {
    pub verified_at: u64,
    pub expiry: u64,
}

#[contracttype]
pub enum DataKey {
    Verifier,
    IssuerRegistry,
    /// Cached verification, keyed by (holder, credential_type).
    Proof(Address, Symbol),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    VerificationFailed = 2,
    UnknownCredentialType = 3,
    NotAuthorized = 4,
    IssuerNotTrusted = 5,
}

#[contract]
pub struct ProofRegistry;

#[contractimpl]
impl ProofRegistry {
    /// `verifier` and `issuer_registry` are the deployed contract addresses.
    pub fn __constructor(env: Env, verifier: Address, issuer_registry: Address) {
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage()
            .instance()
            .set(&DataKey::IssuerRegistry, &issuer_registry);
    }

    /// Verify a proof and, if valid, cache it for `holder` until `expiry`
    /// (ledger timestamp, seconds). The holder authorizes their own submission.
    /// `issuer_id` must be registered and trusted for `credential_type`.
    pub fn submit_proof(
        env: Env,
        holder: Address,
        issuer_id: Address,
        credential_type: Symbol,
        proof: Bytes,
        public_inputs: Bytes,
        expiry: u64,
    ) {
        holder.require_auth();

        // 1. The named issuer must be trusted for this credential type.
        let registry = IssuerClient::new(&env, &Self::issuer_registry(&env));
        if !registry.is_valid_issuer(&issuer_id, &credential_type) {
            panic_with_error!(&env, Error::IssuerNotTrusted);
        }

        // 2. The proof must verify against the registered VK.
        let verifier = VerifierClient::new(&env, &Self::verifier(&env));
        let ok = Self::dispatch_verify(&env, &verifier, &credential_type, &proof, &public_inputs);
        if !ok {
            panic_with_error!(&env, Error::VerificationFailed);
        }

        let key = DataKey::Proof(holder, credential_type);
        let record = ProofRecord {
            verified_at: env.ledger().timestamp(),
            expiry,
        };
        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, PROOF_BUMP_THRESHOLD, PROOF_TTL);
    }

    /// Returns `(is_currently_valid, verified_at, expiry)`. `is_currently_valid`
    /// accounts for expiry against the current ledger time.
    pub fn is_verified(env: Env, holder: Address, credential_type: Symbol) -> (bool, u64, u64) {
        match env
            .storage()
            .persistent()
            .get::<_, ProofRecord>(&DataKey::Proof(holder, credential_type))
        {
            Some(r) => {
                let valid = r.expiry > env.ledger().timestamp();
                (valid, r.verified_at, r.expiry)
            }
            None => (false, 0, 0),
        }
    }

    /// Revoke a cached proof. The holder authorizes their own revocation.
    pub fn revoke_proof(env: Env, holder: Address, credential_type: Symbol) {
        holder.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Proof(holder, credential_type));
    }

    pub fn verifier_address(env: Env) -> Address {
        Self::verifier(&env)
    }

    pub fn issuer_registry_address(env: Env) -> Address {
        Self::issuer_registry(&env)
    }

    fn dispatch_verify(
        env: &Env,
        verifier: &VerifierClient,
        credential_type: &Symbol,
        proof: &Bytes,
        public_inputs: &Bytes,
    ) -> bool {
        if *credential_type == symbol_short!("kyc") {
            verifier.verify_kyc_proof(proof, public_inputs)
        } else if *credential_type == symbol_short!("age") {
            verifier.verify_age_proof(proof, public_inputs)
        } else if *credential_type == Symbol::new(env, "jurisdiction") {
            verifier.verify_jurisdiction_proof(proof, public_inputs)
        } else if *credential_type == symbol_short!("income") {
            verifier.verify_income_proof(proof, public_inputs)
        } else {
            panic_with_error!(env, Error::UnknownCredentialType)
        }
    }

    fn verifier(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Verifier)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn issuer_registry(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::IssuerRegistry)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

mod test;
