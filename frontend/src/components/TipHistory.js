import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchTips } from "../solana/fetchTips";

export default function TipHistory({ programId }) {
    const { publicKey } = useWallet();
    const [tips, setTips] = useState([]);

    useEffect(() => {
        if (!publicKey) return;
        const loadTips = async () => {
            const history = await fetchTips({ publicKey }, programId);
            setTips(history);
        };
        loadTips();
    }, [publicKey]);

    return (
        <div>
            <h3>Tip History</h3>
            <ul>
                {tips.map((t, idx) => (
                    <li key={idx}>
                        From: {t.sender}, Amount: {t.amount} SOL, Timestamp: {new Date(t.timestamp * 1000).toLocaleString()}
                    </li>
                ))}
            </ul>
        </div>
    );
}
