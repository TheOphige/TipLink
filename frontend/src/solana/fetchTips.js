import * as anchor from "@project-serum/anchor";
import IDL from "../idl/tipping.json";
import { connection } from "./connection";

export const fetchTips = async (wallet, programId) => {
    if (!wallet.publicKey) return [];
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
    const program = new anchor.Program(IDL, programId, provider);

    const tips = await program.account.tip.all([
        {
            memcmp: {
                offset: 32, // recipient starts at byte offset 32
                bytes: wallet.publicKey.toBase58(),
            },
        },
    ]);

    return tips.map(t => ({
        sender: t.account.sender.toBase58(),
        amount: t.account.amount.toNumber(),
        tokenMint: t.account.tokenMint.toBase58(), // token mint address
        timestamp: t.account.timestamp.toNumber(),
    }));
};
