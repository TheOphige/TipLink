import { useWallet } from "@solana/wallet-adapter-react";

export default function ConnectWalletButton() {
    const { connected, connect, disconnect } = useWallet();
    return connected ? (
        <button onClick={disconnect}>Disconnect Wallet</button>
    ) : (
        <button onClick={connect}>Connect Wallet</button>
    );
}
