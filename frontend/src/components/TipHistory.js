import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchTips } from "../solana/fetchTips";

const TOKEN_NAMES = {
    "So11111111111111111111111111111111111111112": "SOL", // native SOL pseudo-mint
    "YourUSDCMintAddressHere": "USDC",
    "YourBONKMintAddressHere": "BONK",
};

export default function TipHistory({ programId }) {
    const { publicKey } = useWallet();
    const [tips, setTips] = useState([]);

    useEffect(() => {
        if (!publicKey) return;
        const loadTips = async () => {
            const history = await fetchTips(publicKey, programId);
            setTips(history.sort((a, b) => b.timestamp - a.timestamp)); // newest first
        };
        loadTips();
    }, [publicKey]);

    return (
        <div>
            <h3>Tip History</h3>
            {tips.length === 0 ? (
                <p>No tips received yet.</p>
            ) : (
                <ul>
                    {tips.map((t, idx) => (
                        <li key={idx}>
                            From: {t.sender} | Amount: {t.amount} {TOKEN_NAMES[t.tokenMint] || t.tokenMint} |{" "}
                            {new Date(t.timestamp * 1000).toLocaleString()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
