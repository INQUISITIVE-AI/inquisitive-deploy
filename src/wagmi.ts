import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const hasRealProjectId = projectId && projectId !== 'YOUR_WALLETCONNECT_PROJECT_ID' && projectId.length > 8;

export const config = createConfig({
  chains: [mainnet],
  connectors: hasRealProjectId
    ? [injected(), walletConnect({ projectId: projectId! })]
    : [injected()],
  transports: {
    [mainnet.id]: http(),
  },
});
