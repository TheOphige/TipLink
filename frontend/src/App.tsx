import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import type { Cluster } from '@solana/web3.js';   
import { useMemo } from 'react';
import type { FC, ReactNode } from 'react';       
import TipLink from './TipLink';
import '@solana/wallet-adapter-react-ui/styles.css';

const App: FC = () => {
  console.log('App component rendered'); 
  return (
    <Context>
      <TipLink />
    </Context>
  );
};

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  const network = 'devnet' as Cluster;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;


