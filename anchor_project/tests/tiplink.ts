import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Tiplink } from "../target/types/tiplink";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("tiplink", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Tiplink as Program<Tiplink>;
  const sender = provider.wallet.publicKey;
  const recipient = anchor.web3.Keypair.generate().publicKey;

  it("Sends SOL tip (happy path)", async () => {
    const [tipPDA, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("tip"), sender.toBuffer(), recipient.toBuffer(), Buffer.from(Date.now().toString())],
      program.programId
    );

    await program.methods
      .sendTip(new anchor.BN(1_000_000_000), SystemProgram.programId) // 1 SOL
      .accounts({
        tip: tipPDA,
        sender,
        recipient,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const tipAccount = await program.account.tip.fetch(tipPDA);
    assert.equal(tipAccount.amount.toNumber(), 1_000_000_000);
    assert.equal(tipAccount.recipient.toBase58(), recipient.toBase58());
  });

  it("Fails with zero amount (unhappy path)", async () => {
    const [tipPDA, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("tip"), sender.toBuffer(), recipient.toBuffer(), Buffer.from(Date.now().toString())],
      program.programId
    );

    try {
      await program.methods
        .sendTip(new anchor.BN(0), SystemProgram.programId)
        .accounts({
          tip: tipPDA,
          sender,
          recipient,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should throw error for zero amount");
    } catch (err: any) {
      assert.ok(err.toString().includes("InvalidAmount"));
    }
  });
});
