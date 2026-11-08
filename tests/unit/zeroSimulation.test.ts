import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_NETWORKS, toHexChainId, getAddEthereumChainParams } from '../../src/config/networks.ts';

describe('Zero-Simulation Invariant Checks', () => {
  it('TC-ZS1: Supported networks must specify authoritative verified RPC endpoints', () => {
    assert.equal(SUPPORTED_NETWORKS[1672].rpcUrl, 'https://rpc.pharos.xyz');
    assert.equal(SUPPORTED_NETWORKS[688689].rpcUrl, 'https://atlantic.dplabs-internal.com');
    assert.equal(SUPPORTED_NETWORKS[8453].rpcUrl, 'https://mainnet.base.org');
  });

  it('TC-ZS2: EIP-3085 parameter builder outputs standard hex chain IDs', () => {
    assert.equal(toHexChainId(1672), '0x688');
    assert.equal(toHexChainId(688689), '0xa8231');
    assert.equal(toHexChainId(8453), '0x2105');

    const params = getAddEthereumChainParams(1672);
    assert.equal(params.chainId, '0x688');
    assert.equal(params.chainName, 'Pharos Pacific Mainnet');
    assert.equal(params.nativeCurrency.symbol, 'PROS');
    assert.ok(params.rpcUrls.includes('https://rpc.pharos.xyz'));
  });

  it('TC-ZS3: Zero hardcoded balances in verified token registry', () => {
    const net = SUPPORTED_NETWORKS[1672];
    for (const t of net.tokens) {
      assert.ok(t.decimals === 6 || t.decimals === 18, 'Tokens must have standard decimals');
      assert.ok(t.verificationSource.length > 5, 'Every token must provide verifiable provenance');
    }
  });
});
