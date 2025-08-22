import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tiplink } from "../target/types/tiplink";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("tiplink", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Tiplink as Program<Tiplink>;
  const provider = anchor.getProvider();

  // Test accounts
  let sender: Keypair;
  let recipient: Keypair;
  let tipPda: PublicKey;
  let tipBump: number;

  beforeEach(async () => {
    // Create new keypairs for each test to ensure isolation
    sender = Keypair.generate();
    recipient = Keypair.generate();

    // Airdrop SOL to sender for testing
    const airdropSignature = await provider.connection.requestAirdrop(
      sender.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Derive the PDA for the tip account
    [tipPda, tipBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tip"),
        sender.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  describe("send_tip instruction", () => {
    describe("Happy Path Scenarios", () => {
      it("Should successfully send a SOL tip", async () => {
        const tipAmount = new anchor.BN(1000000); // 0.001 SOL in lamports
        const solMint = PublicKey.default; // Use default pubkey for SOL

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Fetch the created tip account
        const tipAccount = await program.account.tip.fetch(tipPda);

        // Verify the tip account data
        expect(tipAccount.sender.toString()).to.equal(sender.publicKey.toString());
        expect(tipAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
        expect(tipAccount.amount.toString()).to.equal(tipAmount.toString());
        expect(tipAccount.tokenMint.toString()).to.equal(solMint.toString());
        expect(tipAccount.timestamp).to.be.greaterThan(0);
      });

      it("Should successfully send an SPL token tip", async () => {
        const tipAmount = new anchor.BN(5000000); // 5 tokens (assuming 6 decimals)
        const tokenMint = Keypair.generate().publicKey; // Mock token mint

        await program.methods
          .sendTip(tipAmount, tokenMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Fetch the created tip account
        const tipAccount = await program.account.tip.fetch(tipPda);

        // Verify the tip account data
        expect(tipAccount.sender.toString()).to.equal(sender.publicKey.toString());
        expect(tipAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
        expect(tipAccount.amount.toString()).to.equal(tipAmount.toString());
        expect(tipAccount.tokenMint.toString()).to.equal(tokenMint.toString());
        expect(tipAccount.timestamp).to.be.greaterThan(0);
      });

      it("Should successfully send tip with maximum u64 amount", async () => {
        const tipAmount = new anchor.BN("18446744073709551615"); // Max u64
        const solMint = PublicKey.default;

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        const tipAccount = await program.account.tip.fetch(tipPda);
        expect(tipAccount.amount.toString()).to.equal(tipAmount.toString());
      });

      it("Should successfully send tip with minimum valid amount (1)", async () => {
        const tipAmount = new anchor.BN(1); // Minimum valid amount
        const solMint = PublicKey.default;

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        const tipAccount = await program.account.tip.fetch(tipPda);
        expect(tipAccount.amount.toString()).to.equal("1");
      });

      it("Should allow different senders to tip the same recipient", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;
        const secondSender = Keypair.generate();

        // Airdrop SOL to second sender
        const airdropSignature = await provider.connection.requestAirdrop(
          secondSender.publicKey,
          2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropSignature);

        // First tip from original sender
        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Second tip from different sender to same recipient
        const [secondTipPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("tip"),
            secondSender.publicKey.toBuffer(),
            recipient.publicKey.toBuffer(),
          ],
          program.programId
        );

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: secondTipPda,
            sender: secondSender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([secondSender])
          .rpc();

        // Both tips should exist
        const firstTip = await program.account.tip.fetch(tipPda);
        const secondTip = await program.account.tip.fetch(secondTipPda);

        expect(firstTip.sender.toString()).to.equal(sender.publicKey.toString());
        expect(secondTip.sender.toString()).to.equal(secondSender.publicKey.toString());
        expect(firstTip.recipient.toString()).to.equal(recipient.publicKey.toString());
        expect(secondTip.recipient.toString()).to.equal(recipient.publicKey.toString());
      });

      it("Should allow same sender to tip different recipients", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;
        const secondRecipient = Keypair.generate();

        // First tip to original recipient
        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Second tip to different recipient
        const [secondTipPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("tip"),
            sender.publicKey.toBuffer(),
            secondRecipient.publicKey.toBuffer(),
          ],
          program.programId
        );

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: secondTipPda,
            sender: sender.publicKey,
            recipient: secondRecipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Both tips should exist
        const firstTip = await program.account.tip.fetch(tipPda);
        const secondTip = await program.account.tip.fetch(secondTipPda);

        expect(firstTip.recipient.toString()).to.equal(recipient.publicKey.toString());
        expect(secondTip.recipient.toString()).to.equal(secondRecipient.publicKey.toString());
        expect(firstTip.sender.toString()).to.equal(sender.publicKey.toString());
        expect(secondTip.sender.toString()).to.equal(sender.publicKey.toString());
      });

      it("Should correctly set timestamp within reasonable range", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;
        const beforeTime = Math.floor(Date.now() / 1000);

        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        const afterTime = Math.floor(Date.now() / 1000);
        const tipAccount = await program.account.tip.fetch(tipPda);

        expect(tipAccount.timestamp.toNumber()).to.be.greaterThanOrEqual(beforeTime);
        expect(tipAccount.timestamp.toNumber()).to.be.lessThanOrEqual(afterTime);
      });
    });

    describe("Unhappy Path Scenarios (Error Cases)", () => {
      it("Should fail with InvalidAmount error when tip amount is zero", async () => {
        const tipAmount = new anchor.BN(0);
        const solMint = PublicKey.default;

        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: tipPda,
              sender: sender.publicKey,
              recipient: recipient.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([sender])
            .rpc();
          
          // If we reach here, the test should fail
          expect.fail("Expected transaction to fail with InvalidAmount error");
        } catch (error) {
          expect(error.error.errorCode.code).to.equal("InvalidAmount");
          expect(error.error.errorMessage).to.include("Amount must be greater than zero");
        }
      });

      it("Should fail when trying to create duplicate tip from same sender to same recipient", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;

        // First tip should succeed
        await program.methods
          .sendTip(tipAmount, solMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([sender])
          .rpc();

        // Second tip with same sender/recipient should fail
        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: tipPda,
              sender: sender.publicKey,
              recipient: recipient.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([sender])
            .rpc();
          
          expect.fail("Expected transaction to fail due to account already being initialized");
        } catch (error) {
          // Should fail because account is already initialized
          expect(error.message).to.include("already in use");
        }
      });

      it("Should fail when sender doesn't sign the transaction", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;
        const fakeSigner = Keypair.generate();

        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: tipPda,
              sender: sender.publicKey,
              recipient: recipient.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([fakeSigner]) // Wrong signer
            .rpc();
          
          expect.fail("Expected transaction to fail with signature verification error");
        } catch (error) {
          // Should fail due to signature verification
          expect(error.message).to.include("Signature verification failed");
        }
      });

      it("Should fail when using wrong PDA derivation", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;
        const wrongRecipient = Keypair.generate();

        // Create PDA with correct sender but wrong recipient
        const [wrongPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("tip"),
            sender.publicKey.toBuffer(),
            wrongRecipient.publicKey.toBuffer(),
          ],
          program.programId
        );

        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: wrongPda, // Wrong PDA
              sender: sender.publicKey,
              recipient: recipient.publicKey, // Different recipient than used in PDA
              systemProgram: SystemProgram.programId,
            })
            .signers([sender])
            .rpc();
          
          expect.fail("Expected transaction to fail due to PDA seed constraint violation");
        } catch (error) {
          // Should fail due to PDA seed constraint
          expect(error.error.errorCode.code).to.equal("ConstraintSeeds");
        }
      });

      it("Should fail when sender has insufficient funds for rent", async () => {
        const poorSender = Keypair.generate();
        // Don't airdrop SOL to this sender - they'll have 0 balance
        
        const [poorTipPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("tip"),
            poorSender.publicKey.toBuffer(),
            recipient.publicKey.toBuffer(),
          ],
          program.programId
        );

        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;

        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: poorTipPda,
              sender: poorSender.publicKey,
              recipient: recipient.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([poorSender])
            .rpc();
          
          expect.fail("Expected transaction to fail due to insufficient funds");
        } catch (error) {
          // Should fail due to insufficient funds for rent
          expect(error.message).to.include("insufficient");
        }
      });

      it("Should fail when using invalid system program", async () => {
        const tipAmount = new anchor.BN(1000000);
        const solMint = PublicKey.default;

        try {
          await program.methods
            .sendTip(tipAmount, solMint)
            .accounts({
              tip: tipPda,
              sender: sender.publicKey,
              recipient: recipient.publicKey,
              systemProgram: program.programId, // Wrong program ID
            })
            .signers([sender])
            .rpc();
          
          expect.fail("Expected transaction to fail due to incorrect system program");
        } catch (error) {
          // Should fail due to incorrect system program
          expect(error.message).to.include("Invalid program id");
        }
      });
    });
  });

  describe("PDA derivation", () => {
    it("Should derive correct PDA for tip account", async () => {
      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          sender.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        program.programId
      );

      expect(tipPda.toString()).to.equal(expectedPda.toString());
      expect(tipBump).to.equal(expectedBump);
    });

    it("Should generate different PDAs for different sender-recipient pairs", async () => {
      const anotherSender = Keypair.generate();
      const anotherRecipient = Keypair.generate();

      const [pda1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          sender.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [pda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          anotherSender.publicKey.toBuffer(),
          anotherRecipient.publicKey.toBuffer(),
        ],
        program.programId
      );

      expect(pda1.toString()).to.not.equal(pda2.toString());
    });
  });
});