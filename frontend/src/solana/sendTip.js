import { Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import IDL from "../idl/tipping.json";
import { connection } from "./connection";

export const sendTip = async (
    wallet,
    recipientAddress,
    amount,
    programId,
    logOnChain = false,
    tokenMintAddress = null // null = SOL, otherwise SPL token
) => {
    let signature;

    if (!tokenMintAddress) {
        // Send SOL
        const solTransaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: new PublicKey(recipientAddress),
                lamports: amount * 1e9,
            })
        );
        signature = await wallet.sendTransaction(solTransaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
    } else {
        // Send SPL token
        const mintPublicKey = new PublicKey(tokenMintAddress);
        const token = new Token(connection, mintPublicKey, TOKEN_PROGRAM_ID, wallet);

        const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        const toTokenAccount = await token.getOrCreateAssociatedAccountInfo(new PublicKey(recipientAddress));

        const tx = new Transaction().add(
            Token.createTransferInstruction(
                TOKEN_PROGRAM_ID,
                fromTokenAccount.address,
                toTokenAccount.address,
                wallet.publicKey,
                [],
                amount // Amount in smallest units (e.g., for USDC 6 decimals)
            )
        );

        signature = await wallet.sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");
    }

    let logSignature = null;
    if (logOnChain) {
        const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
        const program = new anchor.Program(IDL, programId, provider);
        const tipAccount = anchor.web3.Keypair.generate();

        logSignature = await program.methods.sendTip(new anchor.BN(amount))
            .accounts({
                tip: tipAccount.publicKey,
                sender: wallet.publicKey,
                recipient: new PublicKey(recipientAddress),
                systemProgram: SystemProgram.programId,
            })
            .signers([tipAccount])
            .rpc();
    }

    return { solSignature: signature, logSignature };
};
