import React from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import ConnectWalletButton from "./components/ConnectWalletButton";
import SendTipForm from "./components/SendTipForm";
import TipHistory from "./components/TipHistory";

const PROGRAM_ID = "YourProgramIDHere1111111111111111111111111";

function App() {
    const wallets = [new PhantomWalletAdapter()];

    return (
        <ConnectionProvider endpoint="https://api.devnet.solana.com">
            <WalletProvider wallets={wallets} autoConnect>
                <div style={{ padding: "50px" }}>
                    <h1>TipLink MVP Demo</h1>
                    <ConnectWalletButton />
                    <SendTipForm programId={PROGRAM_ID} />
                    <TipHistory programId={PROGRAM_ID} />
                </div>
            </WalletProvider>
        </ConnectionProvider>
    );
}

export default App;
