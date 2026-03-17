// Vault Rescue Page — for extracting ETH from old vault
import { useState } from 'react';
import Head from 'next/head';
import {
  useAccount, useConnect, useDisconnect,
  useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance,
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatEther, formatUnits } from 'viem';
import { mainnet } from 'wagmi/chains';

// ── Addresses ─────────────────────────────────────────────────────────────────
const VAULT       = '0xaDCFfF8770a162b63693aA84433Ef8B93A35eb52' as `0x${string}`;
const INQAI       = '0xB312B6E0842b6D51b15fdB19e62730815C1C7Ce5' as `0x${string}`;
const WETH        = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`;
const TEAM_WALLET = '0x4e7d700f7E1c6Eeb5c9426A0297AE0765899E746' as `0x${string}`;

// ── Key portfolio tokens ───────────────────────────────────────────────────────
const TOKENS: { sym: string; addr: `0x${string}`; dec: number; fee: number }[] = [
  { sym: 'stETH', addr: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', dec: 18, fee: 100  },
  { sym: 'WBTC',  addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', dec: 8,  fee: 3000 },
  { sym: 'USDC',  addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec: 6,  fee: 500  },
  { sym: 'AAVE',  addr: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', dec: 18, fee: 3000 },
  { sym: 'UNI',   addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', dec: 18, fee: 3000 },
  { sym: 'LDO',   addr: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', dec: 18, fee: 3000 },
  { sym: 'ARB',   addr: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', dec: 18, fee: 3000 },
  { sym: 'LINK',  addr: '0x514910771AF9Ca656af840dff83E8264EcF986CA', dec: 18, fee: 3000 },
  { sym: 'POL',   addr: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6', dec: 18, fee: 3000 },
  { sym: 'RENDER',addr: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', dec: 18, fee: 3000 },
  { sym: 'INQAI', addr: INQAI,                                         dec: 18, fee: 3000 },
];

// ── ABI ───────────────────────────────────────────────────────────────────────
const VAULT_ABI = [
  { name: 'owner',          type: 'function', stateMutability: 'view',       inputs: [],                                                                                                                                                    outputs: [{ type: 'address' }] },
  { name: 'getETHBalance',  type: 'function', stateMutability: 'view',       inputs: [],                                                                                                                                                    outputs: [{ type: 'uint256' }] },
  { name: 'getTokenBalance',type: 'function', stateMutability: 'view',       inputs: [{ name: 'token', type: 'address' }],                                                                                                                  outputs: [{ type: 'uint256' }] },
  { name: 'getPosition',    type: 'function', stateMutability: 'view',       inputs: [{ name: 'token', type: 'address' }],                                                                                                                  outputs: [{ type: 'uint256' }] },
  { name: 'sellAsset',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'minEthOut', type: 'uint256' }, { name: 'poolFee', type: 'uint24' }, { name: 'signalLabel', type: 'string' }], outputs: [] },
  { name: 'withdrawLend',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }],                                                                            outputs: [] },
  { name: 'collectFees',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawETH',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'emergencyWithdraw',type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'rescueETH',        type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:  { minHeight: '100vh', background: '#080810', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", padding: '32px 16px' },
  wrap:  { maxWidth: 760, margin: '0 auto' },
  card:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 22px', marginBottom: 16 },
  row:   { display: 'flex', alignItems: 'center', gap: 12 },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 1 },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  btn:   { border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnRed:  { background: '#ef4444', color: '#fff' },
  btnGray: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' as const },
  btnGreen:{ background: '#10b981', color: '#fff' },
  btnBlue: { background: 'rgba(99,102,241,0.8)', color: '#fff' },
  err:   { marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#fca5a5' },
  txLink:{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  grid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  warn:  { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#fcd34d', marginBottom: 16, lineHeight: 1.7 },
};

// ── Token balance row component ───────────────────────────────────────────────
function TokenRow({ sym, addr, dec, fee, vaultAddr, onSell, onWithdrawLend, onCollectFees, busy }: {
  sym: string; addr: `0x${string}`; dec: number; fee: number;
  vaultAddr: `0x${string}`;
  onSell: (addr: `0x${string}`, fee: number, sym: string) => void;
  onWithdrawLend: (addr: `0x${string}`) => void;
  onCollectFees: (addr: `0x${string}`) => void;
  busy: boolean;
}) {
  const { data: bal }  = useReadContract({ address: VAULT_ABI[2].name === 'getTokenBalance' ? vaultAddr : vaultAddr, abi: VAULT_ABI, functionName: 'getTokenBalance', args: [addr] });
  const { data: pos }  = useReadContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'getPosition', args: [addr] });
  const balNum  = bal  ? Number(formatUnits(bal  as bigint, dec)) : 0;
  const posNum  = pos  ? Number(formatUnits(pos  as bigint, dec)) : 0;
  const hasAny  = balNum > 0 || posNum > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 52, fontWeight: 700, fontSize: 12, color: hasAny ? '#fff' : 'rgba(255,255,255,0.25)' }}>{sym}</div>
      <div style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
        bal: <span style={{ color: balNum > 0 ? '#34d399' : 'rgba(255,255,255,0.2)' }}>{balNum.toFixed(6)}</span>
        {posNum > 0 && <span style={{ color: '#fbbf24', marginLeft: 8 }}>aave: {posNum.toFixed(6)}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {balNum > 0 && (
          <button style={{ ...S.btn, ...S.btnRed, fontSize: 11, padding: '5px 10px', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => onSell(addr, fee, sym)}>
            Sell→ETH
          </button>
        )}
        {posNum > 0 && (
          <button style={{ ...S.btn, ...S.btnGreen, fontSize: 11, padding: '5px 10px', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => onWithdrawLend(addr)}>
            Unlend
          </button>
        )}
        {balNum > 0 && (
          <button style={{ ...S.btn, ...S.btnBlue, fontSize: 11, padding: '5px 10px', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => onCollectFees(addr)}>
            Fees
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Rescue() {
  const { address, isConnected, chain }  = useAccount();
  const { connect }                      = useConnect();
  const { disconnect }                   = useDisconnect();
  const { writeContractAsync }           = useWriteContract();
  const wrongChain = isConnected && chain?.id !== mainnet.id;

  // Vault reads
  const { data: vaultOwner }   = useReadContract({ address: VAULT, abi: VAULT_ABI, functionName: 'owner' });
  const { data: vaultEthBal, refetch: refetchEth }  = useReadContract({ address: VAULT, abi: VAULT_ABI, functionName: 'getETHBalance' });
  const { data: rawEthBal }    = useBalance({ address: VAULT });
  const isOwner = !!address && !!vaultOwner && address.toLowerCase() === (vaultOwner as string).toLowerCase();

  // Manual sell state
  const [manualToken,  setManualToken]  = useState('');
  const [manualAmt,    setManualAmt]    = useState('');
  const [manualFee,    setManualFee]    = useState('3000');
  const [manualMin,    setManualMin]    = useState('0');

  // TX / error state
  const [tx,    setTx]    = useState<`0x${string}` | null>(null);
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [label, setLabel] = useState('');
  const { isSuccess: txDone } = useWaitForTransactionReceipt({ hash: tx ?? undefined });

  const exec = async (name: string, fn: () => Promise<`0x${string}`>) => {
    setErr(''); setBusy(true); setLabel(name); setTx(null);
    try { setTx(await fn()); } catch (e: any) { setErr(e?.shortMessage || e?.message || 'Rejected'); }
    finally { setBusy(false); }
  };

  const handleSell = (tokenIn: `0x${string}`, fee: number, sym: string) => exec(`Sell ${sym}→ETH`, () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'sellAsset',
      args: [tokenIn, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935'), 0n, fee, `RESCUE:${sym}`] })
  );

  const handleWithdrawLend = (asset: `0x${string}`) => exec('Withdraw from Aave', () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'withdrawLend',
      args: [asset, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')] })
  );

  const handleCollectFees = (token: `0x${string}`) => exec('Collect Fees', () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'collectFees',
      args: [token, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')] })
  );

  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [gelatoAmt,   setGelatoAmt]   = useState('');

  const handleWithdrawETH = () => exec('withdrawETH', () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'withdrawETH',
      args: [withdrawAmt ? BigInt(Math.floor(Number(withdrawAmt) * 1e18)) : (rawEthBal?.value ?? 0n)] })
  );

  const handleEmergencyWithdraw = () => exec('emergencyWithdraw', () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'emergencyWithdraw', args: [] })
  );

  const handleRescueETH = () => exec('rescueETH → team wallet', () =>
    writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'rescueETH',
      args: [TEAM_WALLET, withdrawAmt ? BigInt(Math.floor(Number(withdrawAmt) * 1e18)) : (rawEthBal?.value ?? 0n)] })
  );

  const handleManualSell = () => {
    if (!manualToken || !manualAmt) return;
    exec(`Manual sell`, () =>
      writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: 'sellAsset',
        args: [manualToken as `0x${string}`, BigInt(Math.floor(Number(manualAmt) * 1e18)), BigInt(Math.floor(Number(manualMin) * 1e18)), Number(manualFee) as any, 'RESCUE:MANUAL'] })
    );
  };

  const ethBal    = vaultEthBal ? Number(formatEther(vaultEthBal as bigint)).toFixed(6) : '—';
  const rawEth    = rawEthBal   ? Number(formatEther(rawEthBal.value)).toFixed(6)        : '—';

  return (
    <>
      <Head>
        <title>Vault Rescue — INQUISITIVE</title>
        <meta name="robots" content="noindex,nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <div style={S.wrap}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>VAULT MANAGEMENT · OWNER ONLY</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Vault Asset Rescue</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              Sell positions → ETH · Withdraw lending · Collect fees<br />
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{VAULT}</span>
            </p>
          </div>

          {/* Warning */}
          <div style={S.warn}>
            ⚠️ <strong>Owner-only functions.</strong> All sell/withdraw/collect calls go to the vault contract. ETH recovered sits in the vault — use your wallet or Etherscan to move it out after. Slippage set to 0 (accept any amount) — adjust manually if needed.
          </div>

          {/* Wallet */}
          <div style={S.card}>
            <div style={{ ...S.row, justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {isConnected ? <span style={{ fontFamily: 'monospace' }}>{address?.slice(0,6)}…{address?.slice(-4)}</span> : 'Not connected'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {wrongChain && '⚠️ Switch to Ethereum Mainnet · '}
                  {isOwner ? '✅ Vault owner' : isConnected ? '⛔ Not vault owner' : ''}
                </div>
              </div>
              {isConnected
                ? <button style={{ ...S.btn, ...S.btnGray, cursor: 'pointer' }} onClick={() => disconnect()}>Disconnect</button>
                : <button style={{ ...S.btn, ...S.btnBlue }}               onClick={() => connect({ connector: injected() })}>Connect MetaMask</button>
              }
            </div>
          </div>

          {/* ETH Balance */}
          <div style={{ ...S.card, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)' }}>
            <div style={S.label}>Vault ETH Balance</div>
            <div style={{ display: 'flex', gap: 28, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399' }}>{rawEth} ETH</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>on-chain balance (raw)</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#6ee7b7' }}>{ethBal} ETH</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>getETHBalance() internal</div>
              </div>
              <button style={{ ...S.btn, ...S.btnGray, cursor: 'pointer', marginLeft: 'auto', alignSelf: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }} onClick={() => refetchEth()}>↺</button>
            </div>
          </div>

          {/* Direct ETH Rescue */}
          <div style={{ ...S.card, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={S.label}>Direct ETH Rescue — from old vault/keeper contract</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 8, lineHeight: 1.7 }}>
              Try each function — only one will exist in the contract. If all fail, use
              {' '}<a href={`https://etherscan.io/address/${VAULT}#writeContract`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>Etherscan Write Contract ↗</a>
              {' '}to call any function directly.
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: '#34d399', marginBottom: 14 }}>
              <strong>rescueETH</strong> sends directly to team wallet:{' '}
              <a href={`https://etherscan.io/address/${TEAM_WALLET}`} target="_blank" rel="noreferrer" style={{ color: '#6ee7b7', fontFamily: 'monospace' }}>{TEAM_WALLET}</a>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={S.label}>ETH amount (leave blank for full balance)</div>
              <input style={{ ...S.input, width: 220 }} placeholder="0.0 (full balance)" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
              <button style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy ? S.btnGray : S.btnRed) }}
                disabled={!isConnected || wrongChain || !isOwner || busy}
                onClick={handleWithdrawETH}>
                {busy && label === 'withdrawETH' ? '⏳...' : 'withdrawETH(amount)'}
              </button>
              <button style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy ? S.btnGray : S.btnRed) }}
                disabled={!isConnected || wrongChain || !isOwner || busy}
                onClick={handleEmergencyWithdraw}>
                {busy && label === 'emergencyWithdraw' ? '⏳...' : 'emergencyWithdraw()'}
              </button>
              <button style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy ? S.btnGray : S.btnRed) }}
                disabled={!isConnected || wrongChain || !isOwner || busy}
                onClick={handleRescueETH}>
                {busy && label === 'rescueETH' ? '⏳...' : 'rescueETH(to, amount)'}
              </button>
              <a href={`https://etherscan.io/address/${VAULT}#writeContract`} target="_blank" rel="noreferrer"
                style={{ ...S.btn, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', textDecoration: 'none', display: 'inline-block' }}>
                Open Etherscan ↗
              </a>
            </div>
          </div>

          {/* Gelato Treasury */}
          <div style={{ ...S.card, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.03)' }}>
            <div style={S.label}>Gelato Keeper Treasury — ETH recovery</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 12, lineHeight: 1.7 }}>
              If you funded a Gelato keeper task with ETH, withdraw it from the Gelato treasury.
              Go to <a href="https://app.gelato.network" target="_blank" rel="noreferrer" style={{ color: '#fbbf24' }}>app.gelato.network ↗</a>,
              connect your wallet, find your task, and cancel it to release the ETH balance.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="https://app.gelato.network" target="_blank" rel="noreferrer"
                style={{ ...S.btn, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none', display: 'inline-block' }}>
                Gelato App ↗
              </a>
              <a href={`https://etherscan.io/address/0x3AC05161b76a35c1c28dC99Aa602BfdBA80B5ea7#writeContract`} target="_blank" rel="noreferrer"
                style={{ ...S.btn, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', textDecoration: 'none', display: 'inline-block' }}>
                Gelato Treasury Etherscan ↗
              </a>
            </div>
          </div>

          {/* Token positions */}
          <div style={S.card}>
            <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={S.label}>Token Positions</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Sell→ETH converts full balance · Unlend withdraws from Aave · Fees collects protocol fees</div>
            </div>
            {TOKENS.map(t => (
              <TokenRow key={t.addr} {...t} vaultAddr={VAULT}
                onSell={handleSell} onWithdrawLend={handleWithdrawLend}
                onCollectFees={handleCollectFees} busy={busy || !isOwner || wrongChain || !isConnected}
              />
            ))}
          </div>

          {/* Manual sell */}
          <div style={S.card}>
            <div style={S.label}>Manual Sell — Any Token</div>
            <div style={{ ...S.grid, marginTop: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={S.label}>Token address</div>
                <input style={S.input} placeholder="0x..." value={manualToken} onChange={e => setManualToken(e.target.value)} />
              </div>
              <div>
                <div style={S.label}>Amount (full token units, e.g. 1.5)</div>
                <input style={S.input} placeholder="1.0" value={manualAmt} onChange={e => setManualAmt(e.target.value)} />
              </div>
              <div>
                <div style={S.label}>Pool fee (100/500/3000/10000)</div>
                <input style={S.input} placeholder="3000" value={manualFee} onChange={e => setManualFee(e.target.value)} />
              </div>
              <div>
                <div style={S.label}>Min ETH out (0 = no slippage protection)</div>
                <input style={S.input} placeholder="0" value={manualMin} onChange={e => setManualMin(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy || !manualToken || !manualAmt ? S.btnGray : S.btnRed) }}
                disabled={!isConnected || wrongChain || !isOwner || busy || !manualToken || !manualAmt}
                onClick={handleManualSell}
              >
                {busy && label.startsWith('Manual') ? '⏳ Executing...' : 'Sell Token → ETH'}
              </button>
            </div>
          </div>

          {/* TX status */}
          {(tx || err) && (
            <div style={S.card}>
              {tx && (
                <div style={S.txLink}>
                  <span style={{ color: txDone ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{txDone ? `✓ ${label} confirmed` : `⏳ ${label} pending...`}</span>
                  <br />
                  <a href={`https://etherscan.io/tx/${tx}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{tx}</a>
                </div>
              )}
              {err && <div style={S.err}>{err}</div>}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>
            Vault Management UI · Old Vault: {VAULT}
          </div>

        </div>
      </div>
    </>
  );
}
