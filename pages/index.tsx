import { useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useDeployContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { encodeFunctionData } from 'viem';
import { mainnet } from 'wagmi/chains';
import vaultArtifact from '../src/vaultArtifact.json';

// ── Vault ─────────────────────────────────────────────────────────────────────
const STUB_ADDR      = '0xaDCFfF8770a162b63693aA84433Ef8B93A35eb52' as `0x${string}`;
const NEW_VAULT_ADDR = '0x721b0c1fcf28646d6e0f608a15495f7227cb6cfb' as `0x${string}`;
const INQAI_TOKEN    = '0xB312B6E0842b6D51b15fdB19e62730815C1C7Ce5' as `0x${string}`;

const VAULT_ABI = [
  { name: 'owner',                 type: 'function', stateMutability: 'view',       inputs: [],                                                                                          outputs: [{ type: 'address' }] },
  { name: 'automationEnabled',     type: 'function', stateMutability: 'view',       inputs: [],                                                                                          outputs: [{ type: 'bool'    }] },
  { name: 'getPortfolioLength',    type: 'function', stateMutability: 'view',       inputs: [],                                                                                          outputs: [{ type: 'uint256' }] },
  { name: 'getPhase2Length',       type: 'function', stateMutability: 'view',       inputs: [],                                                                                          outputs: [{ type: 'uint256' }] },
  { name: 'setPortfolio',          type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_tokens', type: 'address[]' }, { name: '_weights', type: 'uint256[]' }, { name: '_fees', type: 'uint24[]' }], outputs: [] },
  { name: 'setPhase2Registry',     type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'tuple[]', components: [{ name: 'tokenAddr', type: 'bytes' }, { name: 'chainId', type: 'uint256' }, { name: 'receiver', type: 'bytes' }, { name: 'weightBps', type: 'uint256' }, { name: 'symbol', type: 'string' }] }], outputs: [] },
  { name: 'setAutomationEnabled',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_enabled', type: 'bool' }], outputs: [] },
] as const;

// ── ETH-mainnet tokens (32) ───────────────────────────────────────────────────
const PHASE1: { sym: string; addr: `0x${string}`; fee: number; w: number }[] = [
  { sym: 'BTC',  addr: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', fee: 3000, w: 3419 },
  { sym: 'ETH',  addr: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', fee: 100,  w: 2244 },
  { sym: 'USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', fee: 500,  w: 585  },
  { sym: 'AAVE', addr: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', fee: 3000, w: 390  },
  { sym: 'UNI',  addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', fee: 3000, w: 390  },
  { sym: 'LDO',  addr: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', fee: 3000, w: 292  },
  { sym: 'ARB',  addr: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', fee: 3000, w: 292  },
  { sym: 'PAXG', addr: '0x45804880De22913dAFE09f4980848ECE6EcbAf78', fee: 3000, w: 292  },
  { sym: 'INJ',  addr: '0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30', fee: 3000, w: 195  },
  { sym: 'ENA',  addr: '0x57e114B691Db790C35207b2e685D4A43181e6061', fee: 3000, w: 195  },
  { sym: 'POL',  addr: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6', fee: 3000, w: 195  },
  { sym: 'FET',  addr: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85', fee: 3000, w: 195  },
  { sym: 'RENDER', addr: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', fee: 3000, w: 195  },
  { sym: 'LINK', addr: '0x514910771AF9Ca656af840dff83E8264EcF986CA', fee: 3000, w: 195  },
  { sym: 'ONDO', addr: '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3', fee: 3000, w: 195  },
  { sym: 'GRT',  addr: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', fee: 3000, w: 97   },
  { sym: 'SKY',  addr: '0x56072C95FAA701256059aa122697B133aDEd9279', fee: 3000, w: 97   },
  { sym: 'STRK', addr: '0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766', fee: 3000, w: 97   },
  { sym: 'QNT',  addr: '0x4a220E6096B25EADb88358cb44068A3248254675', fee: 3000, w: 48   },
  { sym: 'ZRO',  addr: '0x6985884C4392D348587B19cb9eAAf157F13271cd', fee: 3000, w: 48   },
  { sym: 'CHZ',  addr: '0x3506424F91fD33084466F402d5D97f05F8e3b4AF', fee: 3000, w: 48   },
  { sym: 'ACH',  addr: '0x4E15361FD6b4BB609Fa63C81A2be19d873717870', fee: 3000, w: 19   },
  { sym: 'DBR',  addr: '0xdBe2C93A4e82a177617F4a43Ee1A69c69Ee8e7E6', fee: 3000, w: 19   },
  { sym: 'XSGD', addr: '0x70e8dE73cE538DA2bEEd35d14187F6959a8ecA96', fee: 3000, w: 19   },
  { sym: 'BRZ',  addr: '0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B', fee: 3000, w: 19   },
  { sym: 'JPYC', addr: '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB', fee: 3000, w: 19   },
  { sym: 'TAO',  addr: '0x77E06c9eCCf2E797fd462A92B6D7642EF85b0A44', fee: 3000, w: 48   },
  { sym: 'NEAR', addr: '0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4', fee: 3000, w: 48   },
  { sym: 'ATOM', addr: '0x8D983cb9388EaC77af0474fA441C4815500Cb7BB', fee: 3000, w: 48   },
  { sym: 'XCN',  addr: '0xa2cd3d43c775978a96bdbf12d733d5a1ed94fb18', fee: 3000, w: 19   },
  { sym: 'SOIL', addr: '0x54991328Ab43c7D5d31C19d1B9fa048E77B5cd16', fee: 3000, w: 19   },
  { sym: 'NGN',  addr: '0x17CDB2a01e7a34CbB3DD4b83260B05d0274C8dab', fee: 3000, w: 19   },
];

// ── Encoding helpers ──────────────────────────────────────────────────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToHex(s: string): `0x${string}` {
  const bytes: number[] = [0];
  for (const c of s) {
    let carry = B58.indexOf(c);
    if (carry < 0) throw new Error(`Bad base58 char: ${c}`);
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const c of s) { if (c !== '1') break; bytes.push(0); }
  return ('0x' + bytes.reverse().map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

function tronToHex(t: string): `0x${string}` {
  // T-address: base58check with 0x41 prefix. Decode → strip first byte (0x41) + last 4 (checksum)
  const decoded = base58ToHex(t).slice(2); // remove '0x'
  return ('0x' + decoded.slice(2, decoded.length - 8)) as `0x${string}`; // skip 1-byte prefix + 4-byte checksum
}

function evmToBytes(addr: string): `0x${string}` {
  return addr as `0x${string}`;
}

function strToBytes(s: string): `0x${string}` {
  return ('0x' + Array.from(new TextEncoder().encode(s)).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

// ── Build Phase2 assets array (33 cross-chain) ────────────────────────────────
interface Phase2Input {
  solana: string; bsc: string; avax: string; op: string; tron: string;
  evmAlt: string; xrp: string; cardano: string; bch: string; xmr: string;
  xlm: string; zec: string; ltc: string; hbar: string; sui: string;
  dot: string; fil: string; icp: string; algo: string; xtz: string;
  vaulta: string; arweave: string; canton: string;
}

function buildPhase2(w: Phase2Input) {
  const SOL  = w.solana  ? base58ToHex(w.solana) : ('0x' + '00'.repeat(32)) as `0x${string}`;
  const BSC  = w.bsc     ? evmToBytes(w.bsc)     : ('0x' + '00'.repeat(20)) as `0x${string}`;
  const AVA  = w.avax    ? evmToBytes(w.avax)    : ('0x' + '00'.repeat(20)) as `0x${string}`;
  const OPT  = w.op      ? evmToBytes(w.op)      : ('0x' + '00'.repeat(20)) as `0x${string}`;
  const TRX  = w.tron    ? (w.tron.startsWith('T') ? tronToHex(w.tron) : evmToBytes(w.tron)) : ('0x' + '00'.repeat(20)) as `0x${string}`;
  const EVM2 = w.evmAlt  ? evmToBytes(w.evmAlt)  : ('0x' + '00'.repeat(20)) as `0x${string}`;
  const XRP_R  = w.xrp     ? strToBytes(w.xrp)     : ('0x' as `0x${string}`);
  const ADA_R  = w.cardano ? strToBytes(w.cardano) : ('0x' as `0x${string}`);
  const BCH_R  = w.bch     ? strToBytes(w.bch)     : ('0x' as `0x${string}`);
  const XMR_R  = w.xmr     ? strToBytes(w.xmr)     : ('0x' as `0x${string}`);
  const XLM_R  = w.xlm     ? strToBytes(w.xlm)     : ('0x' as `0x${string}`);
  const ZEC_R  = w.zec     ? strToBytes(w.zec)     : ('0x' as `0x${string}`);
  const LTC_R  = w.ltc     ? strToBytes(w.ltc)     : ('0x' as `0x${string}`);
  const HBAR_R = w.hbar    ? strToBytes(w.hbar)    : ('0x' as `0x${string}`);
  const SUI_R  = w.sui     ? strToBytes(w.sui)     : ('0x' as `0x${string}`);
  const DOT_R  = w.dot     ? strToBytes(w.dot)     : ('0x' as `0x${string}`);
  const FIL_R  = w.fil     ? strToBytes(w.fil)     : ('0x' as `0x${string}`);
  const ICP_R  = w.icp     ? strToBytes(w.icp)     : ('0x' as `0x${string}`);
  const ALGO_R = w.algo    ? strToBytes(w.algo)    : ('0x' as `0x${string}`);
  const XTZ_R  = w.xtz     ? strToBytes(w.xtz)     : ('0x' as `0x${string}`);
  const VLT_R  = w.vaulta  ? strToBytes(w.vaulta)  : ('0x' as `0x${string}`);
  const AR_R   = w.arweave ? strToBytes(w.arweave) : ('0x' as `0x${string}`);
  const CC_R   = w.canton  ? strToBytes(w.canton)  : ('0x' as `0x${string}`);

  return [
    { tokenAddr: base58ToHex('So11111111111111111111111111111111111111112'),   chainId: 7565164n,  receiver: SOL,   weightBps: 800n, symbol: 'SOL'    },
    { tokenAddr: base58ToHex('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),  chainId: 7565164n,  receiver: SOL,   weightBps: 100n, symbol: 'JUP'    },
    { tokenAddr: base58ToHex('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'), chainId: 7565164n,  receiver: SOL,   weightBps: 50n,  symbol: 'JITOSOL'},
    { tokenAddr: base58ToHex('jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v'),  chainId: 7565164n,  receiver: SOL,   weightBps: 50n,  symbol: 'JUPSOL' },
    { tokenAddr: base58ToHex('4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy'),  chainId: 7565164n,  receiver: SOL,   weightBps: 10n,  symbol: 'HONEY'  },
    { tokenAddr: base58ToHex('hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux'),  chainId: 7565164n,  receiver: SOL,   weightBps: 25n,  symbol: 'HNT'    },
    { tokenAddr: base58ToHex('5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm'), chainId: 7565164n,  receiver: SOL,   weightBps: 25n,  symbol: 'INF'    },
    { tokenAddr: evmToBytes('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'),     chainId: 56n,       receiver: BSC,   weightBps: 500n, symbol: 'BNB'    },
    { tokenAddr: evmToBytes('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'),     chainId: 43114n,    receiver: AVA,   weightBps: 300n, symbol: 'AVAX'   },
    { tokenAddr: evmToBytes('0x4200000000000000000000000000000000000042'),     chainId: 10n,       receiver: OPT,   weightBps: 100n, symbol: 'OP'     },
    { tokenAddr: evmToBytes('0x0000000000000000000000000000000000000000'),     chainId: 728126428n,receiver: TRX,   weightBps: 100n, symbol: 'TRX'    },
    { tokenAddr: evmToBytes('0x0000000000000000000000000000000000000000'),     chainId: 999n,      receiver: EVM2,  weightBps: 25n,  symbol: 'HYPE'   },
    { tokenAddr: evmToBytes('0x0000000000000000000000000000000000000000'),     chainId: 61n,       receiver: EVM2,  weightBps: 25n,  symbol: 'ETC'    },
    { tokenAddr: evmToBytes('0x0000000000000000000000000000000000000000'),     chainId: 50n,       receiver: EVM2,  weightBps: 25n,  symbol: 'XDC'    },
    { tokenAddr: evmToBytes('0x0000000000000000000000000000000000000000'),     chainId: 100009n,   receiver: EVM2,  weightBps: 25n,  symbol: 'VET'    },
    { tokenAddr: strToBytes('XRP'),  chainId: 144n,  receiver: XRP_R,  weightBps: 200n, symbol: 'XRP'   },
    { tokenAddr: strToBytes('ADA'),  chainId: 1815n, receiver: ADA_R,  weightBps: 50n,  symbol: 'ADA'   },
    { tokenAddr: strToBytes('NIGHT'),chainId: 1815n, receiver: ADA_R,  weightBps: 10n,  symbol: 'NIGHT' },
    { tokenAddr: strToBytes('BCH'),  chainId: 145n,  receiver: BCH_R,  weightBps: 50n,  symbol: 'BCH'   },
    { tokenAddr: strToBytes('XMR'),  chainId: 128n,  receiver: XMR_R,  weightBps: 25n,  symbol: 'XMR'   },
    { tokenAddr: strToBytes('CC'),   chainId: 7562n, receiver: CC_R,   weightBps: 10n,  symbol: 'CC'    },
    { tokenAddr: strToBytes('XLM'),  chainId: 148n,  receiver: XLM_R,  weightBps: 25n,  symbol: 'XLM'   },
    { tokenAddr: strToBytes('ZEC'),  chainId: 133n,  receiver: ZEC_R,  weightBps: 25n,  symbol: 'ZEC'   },
    { tokenAddr: strToBytes('LTC'),  chainId: 2n,    receiver: LTC_R,  weightBps: 25n,  symbol: 'LTC'   },
    { tokenAddr: strToBytes('HBAR'), chainId: 295n,  receiver: HBAR_R, weightBps: 25n,  symbol: 'HBAR'  },
    { tokenAddr: strToBytes('SUI'),  chainId: 784n,  receiver: SUI_R,  weightBps: 25n,  symbol: 'SUI'   },
    { tokenAddr: strToBytes('DOT'),  chainId: 354n,  receiver: DOT_R,  weightBps: 25n,  symbol: 'DOT'   },
    { tokenAddr: strToBytes('FIL'),  chainId: 314n,  receiver: FIL_R,  weightBps: 25n,  symbol: 'FIL'   },
    { tokenAddr: strToBytes('ICP'),  chainId: 223n,  receiver: ICP_R,  weightBps: 25n,  symbol: 'ICP'   },
    { tokenAddr: strToBytes('ALGO'), chainId: 283n,  receiver: ALGO_R, weightBps: 25n,  symbol: 'ALGO'  },
    { tokenAddr: strToBytes('XTZ'),  chainId: 1729n, receiver: XTZ_R,  weightBps: 25n,  symbol: 'XTZ'   },
    { tokenAddr: strToBytes('A'),    chainId: 194n,  receiver: VLT_R,  weightBps: 10n,  symbol: 'A'     },
    { tokenAddr: strToBytes('AR'),   chainId: 472n,  receiver: AR_R,   weightBps: 10n,  symbol: 'AR'    },
  ];
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#0a0a14', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", padding: '40px 20px' },
  wrap: { maxWidth: 820, margin: '0 auto' },
  header: { textAlign: 'center' as const, marginBottom: 48 },
  title: { fontSize: 28, fontWeight: 900, color: '#fff', margin: 0 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 16 },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  stepNum: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#818cf8', flexShrink: 0 },
  stepDone: { background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' },
  stepTitle: { fontSize: 15, fontWeight: 700 },
  stepSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  btn: { padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  btnPrimary: { background: '#6366f1', color: '#fff' },
  btnSuccess: { background: '#10b981', color: '#fff' },
  btnGray: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' },
  btnDanger: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'monospace' },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
  badge: { padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700 },
  txLink: { fontSize: 12, color: '#818cf8', wordBreak: 'break-all' as const, marginTop: 8 },
  error: { fontSize: 12, color: '#f87171', marginTop: 8 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 },
  divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' },
};

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ ...S.badge, background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ok ? '#34d399' : '#f87171', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DeployPage() {
  const { address, isConnected, chain } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync }    = useWriteContract();
  const { deployContractAsync }   = useDeployContract();

  // Active vault address — initialized to deployed Chainlink vault
  const [vaultAddr, setVaultAddr] = useState<`0x${string}`>(NEW_VAULT_ADDR);
  const VAULT_ADDR = vaultAddr;

  // Deploy state
  const [deployTx,   setDeployTx]   = useState<`0x${string}` | null>(null);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployErr,  setDeployErr]  = useState('');
  const { data: deployReceipt, isSuccess: deployDone } = useWaitForTransactionReceipt({ hash: deployTx ?? undefined });

  // Vault state reads
  const { data: vaultOwner,  refetch: refetchOwner  } = useReadContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: 'owner' });
  const { data: portLen,     refetch: refetchPort    } = useReadContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: 'getPortfolioLength' });
  const { data: p2Len,       refetch: refetchP2      } = useReadContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: 'getPhase2Length' });
  const { data: autoEnabled, refetch: refetchAuto    } = useReadContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: 'automationEnabled' });

  const isOwner     = !!address && !!vaultOwner && address.toLowerCase() === (vaultOwner as string).toLowerCase();
  const wrongChain  = isConnected && chain?.id !== mainnet.id;
  const portSet     = portLen != null && Number(portLen) > 0;
  const p2Set       = p2Len   != null && Number(p2Len)   > 0;
  const autoOn               = autoEnabled === true;
  const vaultAlreadyDeployed = vaultAddr !== STUB_ADDR;
  const isDeployed           = deployDone || vaultAlreadyDeployed;

  // Phase 2 wallet inputs
  const [solWallet,    setSolWallet]    = useState('7a2WzumijyGTqALmqoDZd3mvyP2aS7R4GjBdBxMUjRPk');
  const [bscWallet,    setBscWallet]    = useState('0x4e7d700f7E1c6Eeb5c9426A0297AE0765899E746');
  const [avaxWallet,   setAvaxWallet]   = useState('0x4e7d700f7E1c6Eeb5c9426A0297AE0765899E746');
  const [opWallet,     setOpWallet]     = useState('0x4e7d700f7E1c6Eeb5c9426A0297AE0765899E746');
  const [tronWallet,   setTronWallet]   = useState('');
  const [evmAltWallet, setEvmAltWallet] = useState('0x4e7d700f7E1c6Eeb5c9426A0297AE0765899E746');
  const [xrpWallet,    setXrpWallet]    = useState('');
  const [cardanoWallet,setCardanoWallet]= useState('');
  const [bchWallet,    setBchWallet]    = useState('');
  const [xmrWallet,    setXmrWallet]    = useState('');
  const [xlmWallet,    setXlmWallet]    = useState('');
  const [zecWallet,    setZecWallet]    = useState('');
  const [ltcWallet,    setLtcWallet]    = useState('');
  const [hbarWallet,   setHbarWallet]   = useState('');
  const [suiWallet,    setSuiWallet]    = useState('');
  const [dotWallet,    setDotWallet]    = useState('');
  const [filWallet,    setFilWallet]    = useState('');
  const [icpWallet,    setIcpWallet]    = useState('');
  const [algoWallet,   setAlgoWallet]   = useState('');
  const [xtzWallet,    setXtzWallet]    = useState('');
  const [vaultaWallet, setVaultaWallet] = useState('');
  const [arweaveWallet,setArweaveWallet]= useState('');
  const [cantonWallet, setCantonWallet] = useState('');

  // Send INQAI state
  const [sendTo,     setSendTo]     = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendTx,     setSendTx]     = useState<`0x${string}` | null>(null);
  const [sendErr,    setSendErr]    = useState('');
  const [sendBusy,   setSendBusy]   = useState(false);
  const [sendCopied, setSendCopied] = useState(false);
  const { isSuccess: sendDone } = useWaitForTransactionReceipt({ hash: sendTx ?? undefined });

  // Transaction state
  const [tx1, setTx1] = useState<`0x${string}` | null>(null);
  const [tx2, setTx2] = useState<`0x${string}` | null>(null);
  const [tx3, setTx3] = useState<`0x${string}` | null>(null);
  const [err1, setErr1] = useState('');
  const [err2, setErr2] = useState('');
  const [err3, setErr3] = useState('');
  const [busy1, setBusy1] = useState(false);
  const [busy2, setBusy2] = useState(false);
  const [busy3, setBusy3] = useState(false);
  const [copied1, setCopied1] = useState(false);

  const { isSuccess: s1 } = useWaitForTransactionReceipt({ hash: tx1 ?? undefined });
  const { isSuccess: s2 } = useWaitForTransactionReceipt({ hash: tx2 ?? undefined });
  const { isSuccess: s3 } = useWaitForTransactionReceipt({ hash: tx3 ?? undefined });

  // Update vault address from deploy receipt
  const newVaultAddr = deployReceipt?.contractAddress ?? null;
  if (deployDone && newVaultAddr && newVaultAddr !== vaultAddr) {
    setVaultAddr(newVaultAddr as `0x${string}`);
  }

  // ── Step 0: Deploy vault ────────────────────────────────────────────────────
  const handleDeploy = async () => {
    setDeployErr(''); setDeployBusy(true);
    try {
      const hash = await deployContractAsync({
        abi:      vaultArtifact.abi as any,
        bytecode: vaultArtifact.bytecode as `0x${string}`,
        args:     [INQAI_TOKEN],
      });
      setDeployTx(hash);
    } catch (e: any) {
      setDeployErr(e?.shortMessage || e?.message || 'Deploy rejected');
    } finally {
      setDeployBusy(false);
    }
  };

  const refetchAll = useCallback(() => {
    refetchOwner(); refetchPort(); refetchP2(); refetchAuto();
  }, [refetchOwner, refetchPort, refetchP2, refetchAuto]);

  // ── Step 1: setPortfolio calldata (for Trezor/Etherscan fallback) ────────────
  const portfolioCalldata = useMemo(() => {
    try {
      return encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'setPortfolio',
        args: [
          PHASE1.map(t => t.addr),
          PHASE1.map(t => BigInt(t.w)),
          PHASE1.map(t => t.fee),
        ],
      });
    } catch { return null; }
  }, []);

  const handleCopyCalldata = () => {
    if (!portfolioCalldata) return;
    navigator.clipboard.writeText(portfolioCalldata);
    setCopied1(true);
    setTimeout(() => setCopied1(false), 3000);
  };

  // ── Step 1: setPortfolio ────────────────────────────────────────────────────
  const handleSetPortfolio = async () => {
    setErr1(''); setBusy1(true);
    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDR,
        abi: VAULT_ABI,
        functionName: 'setPortfolio',
        args: [
          PHASE1.map(t => t.addr),
          PHASE1.map(t => BigInt(t.w)),
          PHASE1.map(t => t.fee),
        ],
      });
      setTx1(hash);
    } catch (e: any) {
      setErr1(e?.shortMessage || e?.message || 'Transaction rejected');
    } finally {
      setBusy1(false);
    }
  };

  // ── Step 2: setPhase2Registry ───────────────────────────────────────────────
  const handleSetPhase2 = async () => {
    setErr2(''); setBusy2(true);
    try {
      if (!solWallet) throw new Error('Solana wallet required');
      if (!bscWallet) throw new Error('BSC wallet required');
      if (!avaxWallet) throw new Error('Avalanche wallet required');
      if (!opWallet)  throw new Error('Optimism wallet required');
      const assets = buildPhase2({
        solana: solWallet, bsc: bscWallet, avax: avaxWallet, op: opWallet, tron: tronWallet,
        evmAlt: evmAltWallet, xrp: xrpWallet, cardano: cardanoWallet, bch: bchWallet, xmr: xmrWallet,
        xlm: xlmWallet, zec: zecWallet, ltc: ltcWallet, hbar: hbarWallet, sui: suiWallet,
        dot: dotWallet, fil: filWallet, icp: icpWallet, algo: algoWallet, xtz: xtzWallet,
        vaulta: vaultaWallet, arweave: arweaveWallet, canton: cantonWallet,
      });
      const hash = await writeContractAsync({
        address: VAULT_ADDR,
        abi: VAULT_ABI,
        functionName: 'setPhase2Registry',
        args: [assets],
      });
      setTx2(hash);
    } catch (e: any) {
      setErr2(e?.shortMessage || e?.message || 'Transaction rejected');
    } finally {
      setBusy2(false);
    }
  };

  // ── Step 3: setAutomationEnabled ────────────────────────────────────────────
  const handleSetAutomation = async () => {
    setErr3(''); setBusy3(true);
    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDR,
        abi: VAULT_ABI,
        functionName: 'setAutomationEnabled',
        args: [true],
      });
      setTx3(hash);
    } catch (e: any) {
      setErr3(e?.shortMessage || e?.message || 'Transaction rejected');
    } finally {
      setBusy3(false);
    }
  };

  return (
    <>
      <Head>
        <title>INQUISITIVE — Vault Activation</title>
        <meta name="robots" content="noindex" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <div style={S.wrap}>

          {/* Header */}
          <div style={S.header}>
            <div style={{ fontSize: 13, color: '#6366f1', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>INQUISITIVE</div>
            <h1 style={S.title}>Vault Activation</h1>
            <p style={S.sub}>One-time setup — MetaMask signs, no private key anywhere</p>
          </div>

          {/* Wallet connection */}
          <div style={S.card}>
            <div style={{ ...S.row, justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {isConnected ? (
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  ) : 'Wallet not connected'}
                </div>
                {isConnected && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {wrongChain ? '⚠️ Switch to Ethereum Mainnet' : `Chain: ${chain?.name}`}
                    {isOwner ? ' · ✅ Vault owner' : vaultOwner ? ' · ⚠️ Not vault owner' : ''}
                  </div>
                )}
              </div>
              {isConnected ? (
                <button style={{ ...S.btn, ...S.btnDanger }} onClick={() => disconnect()}>Disconnect</button>
              ) : (
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => connect({ connector: injected() })}>Connect MetaMask</button>
              )}
            </div>
          </div>

          {/* Step 0: Deploy full vault */}
          <div style={{ ...S.card, border: isDeployed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.25)', background: isDeployed ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)' }}>
            <div style={S.row}>
              <div style={{ ...S.stepNum, ...(isDeployed ? S.stepDone : { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }) }}>0</div>
              <div style={{ flex: 1 }}>
                <div style={S.stepTitle}>Deploy Full Vault Contract</div>
                <div style={S.stepSub}>
                  {isDeployed
                    ? `✓ Vault live at ${vaultAlreadyDeployed ? vaultAddr : newVaultAddr} — Chainlink Automation enabled (replaces Gelato)`
                    : `Current stub at ${STUB_ADDR} has no performUpkeep(). Deploy the full InquisitiveVaultUpdated contract.`}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {isDeployed ? (
                  <Badge ok label="✓ Deployed" />
                ) : (
                  <button
                    style={{ ...S.btn, ...(!isConnected || wrongChain || deployBusy ? S.btnGray : { background: '#ef4444', color: '#fff' }), cursor: (!isConnected || wrongChain || deployBusy) ? 'not-allowed' : 'pointer' }}
                    disabled={!isConnected || wrongChain || deployBusy}
                    onClick={handleDeploy}
                  >
                    {deployBusy ? '⏳ Deploying...' : 'Deploy Vault'}
                  </button>
                )}
              </div>
            </div>
            {deployTx && (
              <div style={S.txLink}>
                Tx: <a href={`https://etherscan.io/tx/${deployTx}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{deployTx.slice(0, 20)}...</a>
                {deployDone && newVaultAddr && (
                  <span style={{ color: '#34d399', marginLeft: 8 }}>✓ Contract: {newVaultAddr}</span>
                )}
              </div>
            )}
            {deployErr && <div style={S.error}>{deployErr}</div>}
            {deployDone && newVaultAddr && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(16,185,129,0.08)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ color: '#34d399', fontWeight: 700, marginBottom: 6 }}>Next: Update Vercel env var</div>
                <div style={{ fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all' }}>INQUISITIVE_VAULT_ADDRESS={newVaultAddr}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Vercel → Settings → Environment Variables → update → Redeploy</div>
              </div>
            )}
          </div>

          {/* Vault status */}
          <div style={S.card}>
            <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Vault Status</div>
              <button style={{ ...S.btn, padding: '6px 14px', fontSize: 11, ...S.btnGray, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }} onClick={refetchAll}>↺ Refresh</button>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
              {VAULT_ADDR}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
              <Badge ok={portSet}  label={portSet  ? `Portfolio: ${Number(portLen)} tokens ✓` : 'Portfolio: not set'} />
              <Badge ok={p2Set}    label={p2Set    ? `Phase2: ${Number(p2Len)} assets ✓`      : 'Phase2: not set'} />
              <Badge ok={autoOn}   label={autoOn   ? 'Automation: ON ✓' : 'Automation: OFF'} />
            </div>
          </div>

          <div style={S.divider} />

          {/* Step 1: setPortfolio */}
          <div style={S.card}>
            <div style={S.row}>
              <div style={{ ...S.stepNum, ...(portSet || s1 ? S.stepDone : {}) }}>1</div>
              <div>
                <div style={S.stepTitle}>Set Portfolio — 32 ETH-mainnet tokens (Uniswap V3)</div>
                <div style={S.stepSub}>BTC(WBTC), ETH(stETH), USDC, AAVE, UNI, LDO, ARB, PAXG, INJ, ENA, POL, FET, RENDER, LINK, ONDO, GRT, SKY, STRK, QNT, ZRO, CHZ, ACH, DBR, XSGD, BRZ, JPYC, TAO, NEAR, ATOM, XCN, SOIL, NGN</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {portSet || s1 ? (
                  <Badge ok label="✓ Set" />
                ) : (
                  <button
                    style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy1 ? S.btnGray : S.btnPrimary), cursor: (!isConnected || wrongChain || !isOwner || busy1) ? 'not-allowed' : 'pointer' }}
                    disabled={!isConnected || wrongChain || !isOwner || busy1}
                    onClick={handleSetPortfolio}
                  >
                    {busy1 ? '⏳ Waiting...' : 'Sign & Submit'}
                  </button>
                )}
              </div>
            </div>
            {tx1 && (
              <div style={S.txLink}>
                Tx: <a href={`https://etherscan.io/tx/${tx1}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{tx1.slice(0, 20)}...</a>
                {s1 && <span style={{ color: '#34d399', marginLeft: 8 }}>✓ Confirmed</span>}
              </div>
            )}
            {err1 && <div style={S.error}>{err1}</div>}

            {/* Trezor / Etherscan fallback */}
            {!portSet && !s1 && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(255,191,0,0.06)', border: '1px solid rgba(255,191,0,0.2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>🔑 Trezor / hardware wallet?</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10, lineHeight: 1.6 }}>
                  1. Copy the encoded calldata below<br />
                  2. Go to <a href={`https://etherscan.io/address/${VAULT_ADDR}#writeContract`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>Etherscan Write Contract ↗</a><br />
                  3. Connect Trezor via &quot;Hardware Wallet&quot; option<br />
                  4. Call <code style={{ color: '#a78bfa' }}>setPortfolio</code> using the form, or paste raw calldata
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...S.btn, background: copied1 ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.12)', color: copied1 ? '#34d399' : '#fbbf24', border: `1px solid ${copied1 ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'}`, fontSize: 11 }}
                    onClick={handleCopyCalldata}
                  >
                    {copied1 ? '✓ Copied!' : 'Copy Calldata'}
                  </button>
                  <a
                    href={`https://etherscan.io/address/${VAULT_ADDR}#writeContract`}
                    target="_blank" rel="noreferrer"
                    style={{ ...S.btn, ...S.btnGray, fontSize: 11, textDecoration: 'none', display: 'inline-block', cursor: 'pointer', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    Open Etherscan ↗
                  </a>
                </div>
              </div>
            )}

            {/* Token breakdown */}
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>View token array ({PHASE1.length} tokens)</summary>
              <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                {PHASE1.map(t => (
                  <div key={t.sym}><span style={{ color: '#818cf8', display: 'inline-block', width: 52 }}>{t.sym}</span> w:{t.w} fee:{t.fee} {t.addr}</div>
                ))}
              </div>
            </details>
          </div>

          {/* Step 2: setPhase2Registry */}
          <div style={S.card}>
            <div style={S.row}>
              <div style={{ ...S.stepNum, ...(p2Set || s2 ? S.stepDone : {}) }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={S.stepTitle}>Set Phase 2 Registry — 33 cross-chain assets (deBridge DLN)</div>
                <div style={S.stepSub}>SOL, JUP, jitoSOL, jupSOL, HONEY, HNT, INF (Solana) · BNB (BSC) · AVAX · OP · TRX · HYPE, ETC, XDC, VET (EVM-alt) · XRP · ADA, NIGHT (Cardano) · BCH · XMR · CC · XLM · ZEC · LTC · HBAR · SUI · DOT · FIL · ICP · ALGO · XTZ · A · AR</div>
              </div>
              {(p2Set || s2) && <div style={{ marginLeft: 'auto' }}><Badge ok label="✓ Set" /></div>}
            </div>

            {!p2Set && !s2 && (
              <div style={{ marginTop: 20 }}>
                <div style={S.grid2}>
                  <div>
                    <div style={S.label}>Solana wallet (base58)</div>
                    <input style={S.input} placeholder="7a2W..." value={solWallet} onChange={e => setSolWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: SOL, JUP, jitoSOL, jupSOL, HONEY, HNT, INF</div>
                  </div>
                  <div>
                    <div style={S.label}>BSC wallet (0x address)</div>
                    <input style={S.input} placeholder="0x4e..." value={bscWallet} onChange={e => setBscWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: BNB (WBNB)</div>
                  </div>
                  <div>
                    <div style={S.label}>Avalanche wallet (0x address)</div>
                    <input style={S.input} placeholder="0x4e..." value={avaxWallet} onChange={e => setAvaxWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: AVAX (WAVAX)</div>
                  </div>
                  <div>
                    <div style={S.label}>Optimism wallet (0x address)</div>
                    <input style={S.input} placeholder="0x4e..." value={opWallet} onChange={e => setOpWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: OP</div>
                  </div>
                  <div>
                    <div style={S.label}>TRON wallet (T-address or 0x)</div>
                    <input style={S.input} placeholder="TRX... or 0x..." value={tronWallet} onChange={e => setTronWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: TRX · Accepts T-address (base58) or raw 0x</div>
                  </div>
                  <div>
                    <div style={S.label}>EVM-alt wallet (0x) — HYPE · ETC · XDC · VET</div>
                    <input style={S.input} placeholder="0x4e..." value={evmAltWallet} onChange={e => setEvmAltWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Hyperliquid (999) · Ethereum Classic (61) · XDC (50) · VeChain (100009)</div>
                  </div>
                  <div>
                    <div style={S.label}>XRP Ledger address</div>
                    <input style={S.input} placeholder="rXXX..." value={xrpWallet} onChange={e => setXrpWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: XRP</div>
                  </div>
                  <div>
                    <div style={S.label}>Cardano address (addr1...)</div>
                    <input style={S.input} placeholder="addr1..." value={cardanoWallet} onChange={e => setCardanoWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: ADA + NIGHT (Midnight, Cardano native asset)</div>
                  </div>
                  <div>
                    <div style={S.label}>Bitcoin Cash address</div>
                    <input style={S.input} placeholder="bitcoincash:q..." value={bchWallet} onChange={e => setBchWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: BCH</div>
                  </div>
                  <div>
                    <div style={S.label}>Monero address</div>
                    <input style={S.input} placeholder="4..." value={xmrWallet} onChange={e => setXmrWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: XMR</div>
                  </div>
                  <div>
                    <div style={S.label}>Stellar address (G...)</div>
                    <input style={S.input} placeholder="GXXX..." value={xlmWallet} onChange={e => setXlmWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: XLM</div>
                  </div>
                  <div>
                    <div style={S.label}>Zcash address</div>
                    <input style={S.input} placeholder="t1..." value={zecWallet} onChange={e => setZecWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: ZEC</div>
                  </div>
                  <div>
                    <div style={S.label}>Litecoin address</div>
                    <input style={S.input} placeholder="L..." value={ltcWallet} onChange={e => setLtcWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: LTC</div>
                  </div>
                  <div>
                    <div style={S.label}>Hedera account (0.0.XXXXX)</div>
                    <input style={S.input} placeholder="0.0.123456" value={hbarWallet} onChange={e => setHbarWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: HBAR</div>
                  </div>
                  <div>
                    <div style={S.label}>Sui address (0x...)</div>
                    <input style={S.input} placeholder="0x..." value={suiWallet} onChange={e => setSuiWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: SUI</div>
                  </div>
                  <div>
                    <div style={S.label}>Polkadot address (SS58)</div>
                    <input style={S.input} placeholder="1XXX..." value={dotWallet} onChange={e => setDotWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: DOT</div>
                  </div>
                  <div>
                    <div style={S.label}>Filecoin address (f1...)</div>
                    <input style={S.input} placeholder="f1..." value={filWallet} onChange={e => setFilWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: FIL</div>
                  </div>
                  <div>
                    <div style={S.label}>Internet Computer principal</div>
                    <input style={S.input} placeholder="xxxxx-xxxxx-..." value={icpWallet} onChange={e => setIcpWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: ICP</div>
                  </div>
                  <div>
                    <div style={S.label}>Algorand address</div>
                    <input style={S.input} placeholder="AAAA..." value={algoWallet} onChange={e => setAlgoWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: ALGO</div>
                  </div>
                  <div>
                    <div style={S.label}>Tezos address (tz1...)</div>
                    <input style={S.input} placeholder="tz1..." value={xtzWallet} onChange={e => setXtzWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: XTZ</div>
                  </div>
                  <div>
                    <div style={S.label}>Vaulta / EOS account</div>
                    <input style={S.input} placeholder="myaccount" value={vaultaWallet} onChange={e => setVaultaWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: A (Vaulta)</div>
                  </div>
                  <div>
                    <div style={S.label}>Arweave address</div>
                    <input style={S.input} placeholder="ArXXX..." value={arweaveWallet} onChange={e => setArweaveWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: AR</div>
                  </div>
                  <div>
                    <div style={S.label}>Canton Network address</div>
                    <input style={S.input} placeholder="0x... or party ID" value={cantonWallet} onChange={e => setCantonWallet(e.target.value)} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Receives: CC</div>
                  </div>
                </div>
                <div style={{ marginTop: 16, textAlign: 'right' as const }}>
                  <button
                    style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy2 ? S.btnGray : S.btnPrimary), cursor: (!isConnected || wrongChain || !isOwner || busy2) ? 'not-allowed' : 'pointer' }}
                    disabled={!isConnected || wrongChain || !isOwner || busy2}
                    onClick={handleSetPhase2}
                  >
                    {busy2 ? '⏳ Waiting...' : 'Sign & Submit'}
                  </button>
                </div>
                {tx2 && (
                  <div style={S.txLink}>
                    Tx: <a href={`https://etherscan.io/tx/${tx2}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{tx2.slice(0, 20)}...</a>
                    {s2 && <span style={{ color: '#34d399', marginLeft: 8 }}>✓ Confirmed</span>}
                  </div>
                )}
                {err2 && <div style={S.error}>{err2}</div>}
              </div>
            )}
          </div>

          {/* Step 3: setAutomationEnabled */}
          <div style={S.card}>
            <div style={S.row}>
              <div style={{ ...S.stepNum, ...(autoOn || s3 ? S.stepDone : {}) }}>3</div>
              <div>
                <div style={S.stepTitle}>Enable Automation</div>
                <div style={S.stepSub}>Allows Chainlink + Vercel Cron to call performUpkeep() — zero private key execution</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {autoOn || s3 ? (
                  <Badge ok label="✓ Enabled" />
                ) : (
                  <button
                    style={{ ...S.btn, ...(!isConnected || wrongChain || !isOwner || busy3 ? S.btnGray : S.btnSuccess), cursor: (!isConnected || wrongChain || !isOwner || busy3) ? 'not-allowed' : 'pointer' }}
                    disabled={!isConnected || wrongChain || !isOwner || busy3}
                    onClick={handleSetAutomation}
                  >
                    {busy3 ? '⏳ Waiting...' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
            {tx3 && (
              <div style={S.txLink}>
                Tx: <a href={`https://etherscan.io/tx/${tx3}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{tx3.slice(0, 20)}...</a>
                {s3 && <span style={{ color: '#34d399', marginLeft: 8 }}>✓ Confirmed</span>}
              </div>
            )}
            {err3 && <div style={S.error}>{err3}</div>}
          </div>

          {/* Step 4: Chainlink Automation */}
          <div style={{ ...S.card, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)' }}>
            <div style={S.row}>
              <div style={{ ...S.stepNum }}>4</div>
              <div>
                <div style={S.stepTitle}>Register Chainlink Automation</div>
                <div style={S.stepSub}>Register the vault for autonomous performUpkeep() every 60s — any wallet can do this, not just owner</div>
              </div>
              <a
                href={`https://automation.chain.link`}
                target="_blank"
                rel="noreferrer"
                style={{ ...S.btn, ...S.btnPrimary, marginLeft: 'auto', textDecoration: 'none', display: 'inline-block' }}
              >
                Open ↗
              </a>
            </div>
            <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, fontSize: 12, lineHeight: 1.9, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              1. Go to automation.chain.link → New Upkeep → Custom Logic<br />
              2. Contract address: <span style={{ color: '#818cf8' }}>{VAULT_ADDR}</span><br />
              3. Gas limit: 5,000,000<br />
              4. Fund with 1 LINK (~$15/month)<br />
              5. Chainlink nodes call performUpkeep() every 60s — fully autonomous
            </div>
          </div>

          {/* Send INQAI */}
          <div style={S.card}>
            <div style={S.row}>
              <div style={{ ...S.stepNum, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontSize: 13 }}>✉</div>
              <div style={{ flex: 1 }}>
                <div style={S.stepTitle}>Send INQAI</div>
                <div style={S.stepSub}>Transfer INQAI tokens from connected wallet to any address — INQAI only</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={S.grid2}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={S.label}>Recipient address (0x...)</div>
                  <input style={S.input} placeholder="0x..." value={sendTo} onChange={e => setSendTo(e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={S.label}>Amount (INQAI)</div>
                  <input style={S.input} placeholder="0.0" type="number" min="0" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  style={{ ...S.btn, ...(!isConnected || wrongChain || !sendTo || !sendAmount || sendBusy ? S.btnGray : S.btnSuccess), cursor: (!isConnected || wrongChain || !sendTo || !sendAmount || sendBusy) ? 'not-allowed' : 'pointer' }}
                  disabled={!isConnected || wrongChain || !sendTo || !sendAmount || sendBusy}
                  onClick={async () => {
                    setSendErr(''); setSendBusy(true);
                    try {
                      const amt = BigInt(Math.floor(Number(sendAmount) * 1e18));
                      const hash = await writeContractAsync({
                        address: INQAI_TOKEN,
                        abi: [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const,
                        functionName: 'transfer',
                        args: [sendTo as `0x${string}`, amt],
                      });
                      setSendTx(hash);
                    } catch (e: any) {
                      setSendErr(e?.shortMessage || e?.message || 'Transaction rejected');
                    } finally {
                      setSendBusy(false);
                    }
                  }}
                >
                  {sendBusy ? '⏳ Sending...' : 'Send INQAI'}
                </button>
                {sendTx && (
                  <button
                    style={{ ...S.btn, background: sendCopied ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.12)', color: sendCopied ? '#34d399' : '#818cf8', border: `1px solid ${sendCopied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`, fontSize: 11 }}
                    onClick={() => { navigator.clipboard.writeText(sendTx!); setSendCopied(true); setTimeout(() => setSendCopied(false), 2000); }}
                  >
                    {sendCopied ? '✓ Copied' : 'Copy Tx'}
                  </button>
                )}
              </div>
              {sendTx && (
                <div style={S.txLink}>
                  Tx: <a href={`https://etherscan.io/tx/${sendTx}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>{sendTx.slice(0, 20)}...</a>
                  {sendDone && <span style={{ color: '#34d399', marginLeft: 8 }}>✓ Confirmed</span>}
                </div>
              )}
              {sendErr && <div style={S.error}>{sendErr}</div>}
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center' as const, marginTop: 40, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            INQUISITIVE Vault · {VAULT_ADDR} · No private key required
          </div>

        </div>
      </div>
    </>
  );
}
