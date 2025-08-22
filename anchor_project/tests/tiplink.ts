import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tiplink } from "../target/types/tiplink";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("TipLink Program Tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Tiplink as Program<Tiplink>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts
  let sender: Keypair;
  let recipient: Keypair;
  let anotherSender: Keypair;
  let mintAuthority: Keypair;
  let testMint: PublicKey;
  
  // PDAs
  let tipPda: PublicKey;
  let tipBump: number;

  beforeEach(async () => {
    // Create test accounts
    sender = Keypair.generate();
    recipient = Keypair.generate();
    anotherSender = Keypair.generate();
    mintAuthority = Keypair.generate();

    // Airdrop SOL to test accounts
    await connection.confirmTransaction(
      await connection.requestAirdrop(sender.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(recipient.publicKey, 1 * LAMPORTS_PER_SOL)
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(anotherSender.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(mintAuthority.publicKey, 1 * LAMPORTS_PER_SOL)
    );

    // Create test mint
    testMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6 // 6 decimals
    );

    // Derive PDA for tip account
    [tipPda, tipBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tip"),
        sender.publicKey.toBuffer(),
        recipient.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  describe("Happy Path Tests", () => {
    it("Successfully sends SOL tip", async () => {
      const tipAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
      
      // Get initial balances
      const senderInitialBalance = await connection.getBalance(sender.publicKey);
      const recipientInitialBalance = await connection.getBalance(recipient.publicKey);

      // Send tip
      await program.methods
        .sendTip(new anchor.BN(tipAmount), SystemProgram.programId)
        .accounts({
          tip: tipPda,
          sender: sender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: null,
          senderTokenAccount: null,
          recipientTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
        })
        .signers([sender])
        .rpc();

      // Verify balances changed
      const senderFinalBalance = await connection.getBalance(sender.publicKey);
      const recipientFinalBalance = await connection.getBalance(recipient.publicKey);

      expect(recipientFinalBalance).to.equal(recipientInitialBalance + tipAmount);
      expect(senderFinalBalance).to.be.lessThan(senderInitialBalance - tipAmount);

      // Verify tip account was created and populated correctly
      const tipAccount = await program.account.tip.fetch(tipPda);
      expect(tipAccount.sender.toString()).to.equal(sender.publicKey.toString());
      expect(tipAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(tipAccount.amount.toNumber()).to.equal(tipAmount);
      expect(tipAccount.tokenMint.toString()).to.equal(SystemProgram.programId.toString());
      expect(tipAccount.tipCount.toNumber()).to.equal(1);
      expect(tipAccount.bump).to.equal(tipBump);
    });

    it("Successfully sends multiple SOL tips (updates existing tip record)", async () => {
      const firstTipAmount = 0.1 * LAMPORTS_PER_SOL;
      const secondTipAmount = 0.2 * LAMPORTS_PER_SOL;

      // Send first tip
      await program.methods
        .sendTip(new anchor.BN(firstTipAmount), SystemProgram.programId)
        .accounts({
          tip: tipPda,
          sender: sender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: null,
          senderTokenAccount: null,
          recipientTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
        })
        .signers([sender])
        .rpc();

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send second tip
      await program.methods
        .sendTip(new anchor.BN(secondTipAmount), SystemProgram.programId)
        .accounts({
          tip: tipPda,
          sender: sender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: null,
          senderTokenAccount: null,
          recipientTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
        })
        .signers([sender])
        .rpc();

      // Verify tip account was updated
      const tipAccount = await program.account.tip.fetch(tipPda);
      expect(tipAccount.amount.toNumber()).to.equal(secondTipAmount); // Should show latest tip amount
      expect(tipAccount.tipCount.toNumber()).to.equal(2); // Should increment counter
    });

    it("Successfully sends SPL token tip", async () => {
      const tipAmount = 100 * 10**6; // 100 tokens with 6 decimals

      // Create token accounts for sender and recipient
      const senderTokenAccount = await createAccount(
        connection,
        sender,
        testMint,
        sender.publicKey
      );

      const recipientTokenAccount = await createAccount(
        connection,
        recipient,
        testMint,
        recipient.publicKey
      );

      // Mint tokens to sender
      await mintTo(
        connection,
        mintAuthority,
        testMint,
        senderTokenAccount,
        mintAuthority,
        1000 * 10**6 // 1000 tokens
      );

      // Get initial token balances
      const senderInitialTokens = (await getAccount(connection, senderTokenAccount)).amount;
      const recipientInitialTokens = (await getAccount(connection, recipientTokenAccount)).amount;

      // Send SPL token tip
      await program.methods
        .sendTip(new anchor.BN(tipAmount), testMint)
        .accounts({
          tip: tipPda,
          sender: sender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: testMint,
          senderTokenAccount: senderTokenAccount,
          recipientTokenAccount: recipientTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([sender])
        .rpc();

      // Verify token balances changed
      const senderFinalTokens = (await getAccount(connection, senderTokenAccount)).amount;
      const recipientFinalTokens = (await getAccount(connection, recipientTokenAccount)).amount;

      expect(Number(recipientFinalTokens)).to.equal(Number(recipientInitialTokens) + tipAmount);
      expect(Number(senderFinalTokens)).to.equal(Number(senderInitialTokens) - tipAmount);

      // Verify tip account
      const tipAccount = await program.account.tip.fetch(tipPda);
      expect(tipAccount.tokenMint.toString()).to.equal(testMint.toString());
      expect(tipAccount.amount.toNumber()).to.equal(tipAmount);
    });
  });

  describe("Unhappy Path Tests", () => {
    it("Fails when trying to tip yourself", async () => {
      const tipAmount = 0.1 * LAMPORTS_PER_SOL;

      // Derive PDA for self-tip (sender = recipient)
      const [selfTipPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          sender.publicKey.toBuffer(),
          sender.publicKey.toBuffer(), // Same as sender
        ],
        program.programId
      );

      try {
        await program.methods
          .sendTip(new anchor.BN(tipAmount), SystemProgram.programId)
          .accounts({
            tip: selfTipPda,
            sender: sender.publicKey,
            recipient: sender.publicKey, // Same as sender
            systemProgram: SystemProgram.programId,
            mint: null,
            senderTokenAccount: null,
            recipientTokenAccount: null,
            tokenProgram: null,
            associatedTokenProgram: null,
          })
          .signers([sender])
          .rpc();

        // Should not reach here
        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.error.errorCode.code).to.equal("SelfTip");
        expect(error.error.errorMessage).to.include("Cannot tip yourself");
      }
    });

    it("Fails when tip amount is zero", async () => {
      try {
        await program.methods
          .sendTip(new anchor.BN(0), SystemProgram.programId)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: null,
            senderTokenAccount: null,
            recipientTokenAccount: null,
            tokenProgram: null,
            associatedTokenProgram: null,
          })
          .signers([sender])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.error.errorCode.code).to.equal("InvalidAmount");
        expect(error.error.errorMessage).to.include("Amount must be greater than zero");
      }
    });

    it("Fails when sender has insufficient SOL", async () => {
      const poorSender = Keypair.generate();
      
      // Give minimal SOL (just enough for account creation, not for tip)
      await connection.confirmTransaction(
        await connection.requestAirdrop(poorSender.publicKey, 5000000) // Small amount (0.005 SOL)
      );

      const largeTipAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL

      const [poorSenderTipPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          poorSender.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .sendTip(new anchor.BN(largeTipAmount), SystemProgram.programId)
          .accounts({
            tip: poorSenderTipPda,
            sender: poorSender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: null,
            senderTokenAccount: null,
            recipientTokenAccount: null,
            tokenProgram: null,
            associatedTokenProgram: null,
          })
          .signers([poorSender])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (error) {
        // Handle different error formats
        if (error.error && error.error.errorCode) {
          // Anchor custom error
          expect(error.error.errorCode.code).to.equal("InsufficientFunds");
          expect(error.error.errorMessage).to.include("Insufficient funds");
        } else if (error.logs) {
          // System program error - check logs for insufficient funds
          const errorFound = error.logs.some(log => 
            log.includes("insufficient lamports") || 
            log.includes("InsufficientFunds") ||
            log.includes("insufficient funds")
          );
          expect(errorFound).to.be.true;
        } else {
          // Generic transaction error
          expect(error.message || error.toString()).to.include("insufficient");
        }
      }
    });

    it("Fails when sender has insufficient SPL tokens", async () => {
      const tipAmount = 500 * 10**6; // 500 tokens

      // Create token accounts
      const senderTokenAccount = await createAccount(
        connection,
        sender,
        testMint,
        sender.publicKey
      );

      const recipientTokenAccount = await createAccount(
        connection,
        recipient,
        testMint,
        recipient.publicKey
      );

      // Mint only 100 tokens to sender (insufficient for 500 token tip)
      await mintTo(
        connection,
        mintAuthority,
        testMint,
        senderTokenAccount,
        mintAuthority,
        100 * 10**6 // Only 100 tokens
      );

      try {
        await program.methods
          .sendTip(new anchor.BN(tipAmount), testMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: testMint,
            senderTokenAccount: senderTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([sender])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.error.errorCode.code).to.equal("InsufficientFunds");
        expect(error.error.errorMessage).to.include("Insufficient funds");
      }
    });

    it("Fails when required token accounts are missing for SPL token tip", async () => {
      const tipAmount = 100 * 10**6;

      try {
        await program.methods
          .sendTip(new anchor.BN(tipAmount), testMint)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: testMint,
            senderTokenAccount: null, // Missing required account
            recipientTokenAccount: null, // Missing required account
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([sender])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.error.errorCode.code).to.equal("InvalidRecipient");
        expect(error.error.errorMessage).to.include("Recipient address is invalid");
      }
    });

    it("Fails when mint doesn't match token accounts", async () => {
      const tipAmount = 100 * 10**6;
      
      // Create another mint
      const wrongMint = await createMint(
        connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6
      );

      // Create token accounts for the correct mint
      const senderTokenAccount = await createAccount(
        connection,
        sender,
        testMint, // Correct mint
        sender.publicKey
      );

      const recipientTokenAccount = await createAccount(
        connection,
        recipient,
        testMint, // Correct mint
        recipient.publicKey
      );

      try {
        await program.methods
          .sendTip(new anchor.BN(tipAmount), wrongMint) // Wrong mint
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: wrongMint, // This doesn't match the token accounts
            senderTokenAccount: senderTokenAccount,
            recipientTokenAccount: recipientTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([sender])
          .rpc();

        expect.fail("Transaction should have failed");
      } catch (error) {
        expect(error.error.errorCode.code).to.equal("InvalidRecipient");
        expect(error.error.errorMessage).to.include("Recipient address is invalid");
      }
    });
  });

  describe("Edge Cases", () => {
    it("Handles maximum tip amount correctly", async () => {
      // Test with a very large number (but within u64 bounds)
      const maxTipAmount = new anchor.BN("18446744073709551615"); // Close to u64::MAX
      
      // This should fail due to insufficient funds, but the amount validation should pass
      try {
        await program.methods
          .sendTip(maxTipAmount, SystemProgram.programId)
          .accounts({
            tip: tipPda,
            sender: sender.publicKey,
            recipient: recipient.publicKey,
            systemProgram: SystemProgram.programId,
            mint: null,
            senderTokenAccount: null,
            recipientTokenAccount: null,
            tokenProgram: null,
            associatedTokenProgram: null,
          })
          .signers([sender])
          .rpc();

        expect.fail("Transaction should have failed due to insufficient funds");
      } catch (error) {
        // Should fail with insufficient funds, not invalid amount
        expect(error.error.errorCode.code).to.equal("InsufficientFunds");
      }
    });

    it("Multiple users can tip the same recipient", async () => {
      const tipAmount = 0.1 * LAMPORTS_PER_SOL;

      // First sender tips recipient
      await program.methods
        .sendTip(new anchor.BN(tipAmount), SystemProgram.programId)
        .accounts({
          tip: tipPda,
          sender: sender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: null,
          senderTokenAccount: null,
          recipientTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
        })
        .signers([sender])
        .rpc();

      // Another sender tips the same recipient (different PDA)
      const [anotherTipPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("tip"),
          anotherSender.publicKey.toBuffer(),
          recipient.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .sendTip(new anchor.BN(tipAmount), SystemProgram.programId)
        .accounts({
          tip: anotherTipPda,
          sender: anotherSender.publicKey,
          recipient: recipient.publicKey,
          systemProgram: SystemProgram.programId,
          mint: null,
          senderTokenAccount: null,
          recipientTokenAccount: null,
          tokenProgram: null,
          associatedTokenProgram: null,
        })
        .signers([anotherSender])
        .rpc();

      // Verify both tip accounts exist
      const tip1 = await program.account.tip.fetch(tipPda);
      const tip2 = await program.account.tip.fetch(anotherTipPda);

      expect(tip1.sender.toString()).to.equal(sender.publicKey.toString());
      expect(tip2.sender.toString()).to.equal(anotherSender.publicKey.toString());
      expect(tip1.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(tip2.recipient.toString()).to.equal(recipient.publicKey.toString());
    });
  });
});