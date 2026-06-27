"use client";

// Thin wrapper around Stellar Wallets Kit (Freighter, xBull, etc.).
// The kit's `network` option configures which network the kit signs for; it does
// NOT switch the wallet extension's own selected network. So after connecting we
// check the wallet's active network and surface a clear error if it isn't the
// one this app targets (testnet).

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";
import { NETWORK, NETWORK_PASSPHRASE } from "./stellar";

const APP_NETWORK =
  NETWORK === "public" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;

let kit: StellarWalletsKit | null = null;

export function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: APP_NETWORK,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

// Throw a clear, actionable error if the connected wallet is on the wrong
// network (e.g. Freighter still set to Mainnet).
async function assertCorrectNetwork(k: StellarWalletsKit): Promise<void> {
  try {
    const { networkPassphrase } = await k.getNetwork();
    if (networkPassphrase && networkPassphrase !== NETWORK_PASSPHRASE) {
      const want = NETWORK === "public" ? "Mainnet" : "Testnet";
      throw new Error(
        `Wallet is on the wrong network. Switch it to ${want} in your wallet extension, then reconnect.`,
      );
    }
  } catch (e) {
    // Re-throw our own mismatch error; ignore wallets that don't support getNetwork.
    if (e instanceof Error && e.message.startsWith("Wallet is on the wrong")) {
      throw e;
    }
  }
}

export interface Connection {
  address: string;
  walletId: string;
}

export async function connect(): Promise<Connection> {
  const k = getKit();
  return new Promise((resolve, reject) => {
    k.openModal({
      onWalletSelected: async (option) => {
        try {
          k.setWallet(option.id);
          await assertCorrectNetwork(k);
          const { address } = await k.getAddress();
          resolve({ address, walletId: option.id });
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error("dismissed")),
    });
  });
}

// Restore a previously-selected wallet (no modal) after a full page reload.
export async function restore(walletId: string): Promise<string> {
  const k = getKit();
  k.setWallet(walletId);
  const { address } = await k.getAddress();
  return address;
}

/** Sign a transaction XDR with the connected wallet; returns the signed XDR. */
export async function signTx(xdr: string, address: string): Promise<string> {
  const k = getKit();
  const { signedTxXdr } = await k.signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}
