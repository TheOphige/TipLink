# Project Description

**Deployed Frontend URL:** [LINK](https://tip-link.vercel.app/)

**Solana Program ID:** DyC9Xyx6VNyCV5BSHDss2qkoShMDMErt563DTNzz5GXA

## Project Overview

### Description

TipLink is a decentralized tipping application built on Solana. Users can send SOL or SPL tokens directly to other wallets, with optional on-chain logging for verifiable tip records. Each tip is stored in a PDA (Program Derived Address) account, ensuring that tips are securely associated with the sender and recipient without requiring manual account management. This dApp demonstrates Solana program development concepts including PDAs, account creation, SPL token integration, and state management.

### Key Features

* **Send Tip**: Transfer SOL or SPL tokens to any wallet
* **Optional On-Chain Logging**: Record each tip in a PDA account for transparency
* **View Tip History**: Display received tips including sender, amount, token type, and timestamp
* **Multi-Token Support**: Send SOL, USDC, or BONK
* **Wallet Integration**: Connect with Phantom or other Solana wallets

### How to Use the dApp

1. **Connect Wallet** - Connect your Solana wallet using the frontend interface
2. **Send Tip** - Enter recipient wallet address, select token type, amount, and optionally log on-chain
3. **View History** - Check your received tips with detailed information

## Program Architecture

The TipLink dApp uses a simple architecture with one main account type `Tip` and one core instruction `send_tip`. The program leverages PDAs to create deterministic tip accounts for each sender-recipient pair, ensuring data integrity and program ownership.

### PDA Usage

The program uses Program Derived Addresses to create deterministic tip accounts:

**PDAs Used:**

* **Tip PDA**: Derived from seeds `["tip", sender_wallet_pubkey, recipient_wallet_pubkey, timestamp]` - ensures each tip is uniquely recorded and owned by the program

### Program Instructions

**Instructions Implemented:**

* **Send Tip**: Transfers SOL or SPL tokens from sender to recipient and optionally logs the transaction in a PDA account

### Account Structure

```rust
#[account]
pub struct Tip {
    pub sender: Pubkey,        // Wallet sending the tip
    pub recipient: Pubkey,     // Wallet receiving the tip
    pub amount: u64,           // Amount sent in smallest units
    pub token_mint: Pubkey,    // Token mint (SOL pseudo-mint for native SOL)
    pub timestamp: i64,        // Unix timestamp when tip was created
}
```

## Testing

### Test Coverage

Comprehensive test suite covering `send_tip` instruction with both successful operations and error conditions to ensure program security and reliability.

**Happy Path Tests:**

* **Send SOL Tip**: Successfully transfers SOL and logs on-chain if selected
* **Send SPL Token Tip**: Successfully transfers SPL token and logs on-chain if selected

**Unhappy Path Tests:**

* **Zero Amount**: Fails when attempting to send a tip of 0
* **Unauthorized Operations**: Fails if the program rules are violated (e.g., incorrect PDA derivation)
* **Account Not Found**: Fails when attempting to fetch or log a non-existent tip account

### Running Tests

```bash
yarn install    # install dependencies
anchor test     # run tests
```

### Additional Notes for Evaluators

Building TipLink involved learning how to handle deterministic PDAs and integrating SPL token transfers. Optional on-chain logging adds transparency without compromising transfer speed, and the hybrid approach makes the dApp efficient for both small and large-scale usage. The main challenges were correctly deriving PDAs with timestamps and managing multi-token precision for SOL and SPL tokens.
