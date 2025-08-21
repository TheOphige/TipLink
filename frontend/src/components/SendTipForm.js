import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { sendTip } from "../solana/sendTip";

export default function SendTipForm({ programId }) {
    const { publicKey, sendTransaction } = useWallet();
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [status, setStatus] = useState("");
    const [logOnChain, setLogOnChain] = useState(true);

    const handleSend = async () => {
        if (!publicKey) return alert("Connect wallet first");
        setStatus("Sending tip...");
        try {
            const { solSignature, logSignature } = await sendTip({ publicKey, sendTransaction }, recipient, parseFloat(amount), programId, logOnChain);
            setStatus(`SOL sent: ${solSignature}${logSignature ? `, Logged On-chain: ${logSignature}` : ""}`);
        } catch (err) {
            console.error(err);
            setStatus("Failed to send tip");
        }
    };

    return (
        <div>
            <input placeholder="Recipient Wallet" value={recipient} onChange={e => setRecipient(e.target.value)} />
            <input placeholder="Amount (SOL)" value={amount} onChange={e => setAmount(e.target.value)} />
            <label>
                <input type="checkbox" checked={logOnChain} onChange={e => setLogOnChain(e.target.checked)} />
                Log On-Chain
            </label>
            <button onClick={handleSend}>Send Tip</button>
            <div>{status}</div>
        </div>
    );
}
