import { Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import IDL from "../idl/tipping.json";
import { connection } from "./connection";

export const sendTip = async (wallet, recipientAddress, amount, programId, logOnChain = false) => {
    // Step 1: Direct SOL transfer
    const solTransaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(recipientAddress),
            lamports: amount * 1e9,
        })
    );

    const solSignature = await wallet.sendTransaction(solTransaction, connection);
    await connection.confirmTransaction(solSignature, "confirmed");

    let logSignature = null;

    // Step 2: Optional on-chain logging
    if (logOnChain) {
        const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
        const program = new anchor.Program(IDL, programId, provider);
        const tipAccount = anchor.web3.Keypair.generate();

        logSignature = await program.methods.sendTip(new anchor.BN(amount))
            .accounts({
                tip: tipAccount.publicKey,
                sender: wallet.publicKey,
                recipient: new PublicKey(recipientAddress),
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([tipAccount])
            .rpc();
    }

    return { solSignature, logSignature };
};
