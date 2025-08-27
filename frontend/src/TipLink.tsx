import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Idl } from '@coral-xyz/anchor';
import { AnchorProvider, BN, Program, web3 } from '@coral-xyz/anchor';
import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress, getMint } from '@solana/spl-token';
import { Box, Button, Checkbox, FormControlLabel, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer'; // Buffer polyfill for browser
import idl from './idl.json';
import type { FC, ReactNode } from 'react';
import { Component, useCallback, useEffect, useMemo, useState } from 'react';

const PROGRAM_ID = new PublicKey('DyC9Xyx6VNyCV5BSHDss2qkoShMDMErt563DTNzz5GXA');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

interface TipData {
  sender: PublicKey;
  recipient: PublicKey;
  amount: BN;
  tokenMint: PublicKey;
  timestamp: BN;
  tipCount: BN;
  bump: number;
}

const BADGE_THRESHOLD = 5;

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error?: string }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4">TipLink MVP</Typography>
          <Typography color="error">Error: {this.state.error}</Typography>
          <Typography>Please try refreshing or reconnecting your wallet.</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

const TipLink: FC = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [logOnChain, setLogOnChain] = useState(true);
  const [allTips, setAllTips] = useState<TipData[]>([]);
  const [sentTips, setSentTips] = useState<TipData[]>([]);
  const [receivedTips, setReceivedTips] = useState<TipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  console.log('TipLink rendered, publicKey:', publicKey?.toBase58());

  const provider = useMemo(() => {
    if (!wallet) return null;
    console.log('Provider initialized');
    return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    console.log('Program initialized');
    try {
      return new Program(idl as Idl, provider);
    } catch (err) {
      console.error('Program initialization error:', err);
      setError('Failed to initialize program: ' + (err as Error).message);
      return null;
    }
  }, [provider]);

  const fetchAllTips = useCallback(async () => {
    if (!program || !publicKey) {
      console.log('fetchAllTips skipped: program or publicKey missing');
      return;
    }
    console.log('Fetching tips for program:', PROGRAM_ID.toBase58());
    try {
      const filters = [{ dataSize: 129 }];
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, { filters });
      console.log('Fetched accounts:', accounts.length, 'accounts:', accounts.map(acc => acc.pubkey.toBase58()));
      const tips = accounts.map(acc => {
        const decoded = program.coder.accounts.decode('Tip', acc.account.data) as TipData;
        return {
          ...decoded,
          sender: new PublicKey(decoded.sender),
          recipient: new PublicKey(decoded.recipient),
          tokenMint: new PublicKey(decoded.tokenMint),
        };
      });
      console.log('Decoded tips:', tips.map(tip => ({
        sender: tip.sender.toBase58(),
        recipient: tip.recipient.toBase58(),
        amount: tip.amount.toString(),
        tokenMint: tip.tokenMint.toBase58(),
        timestamp: tip.timestamp.toString(),
        tipCount: tip.tipCount.toString(),
        bump: tip.bump,
      })));
      setAllTips(tips);
      setSentTips(tips.filter(tip => tip.sender.equals(publicKey)));
      setReceivedTips(tips.filter(tip => tip.recipient.equals(publicKey)));
      console.log('Tips updated:', {
        allTips: tips.length,
        sentTips: tips.filter(tip => tip.sender.equals(publicKey)).length,
        receivedTips: tips.filter(tip => tip.recipient.equals(publicKey)).length,
      });
    } catch (err: any) {
      console.error('Fetch tips error:', err, 'stack:', err.stack);
      setError('Failed to fetch tip history: ' + err.message);
    }
  }, [program, connection, publicKey]);

  useEffect(() => {
    if (publicKey && program) {
      console.log('Triggering fetchAllTips in useEffect');
      fetchAllTips();
    }
  }, [publicKey, program, fetchAllTips]);

  const getTokenDecimals = useCallback(async (mint: PublicKey) => {
    try {
      if (mint.equals(SystemProgram.programId)) return 9;
      const mintInfo = await getMint(connection, mint);
      return mintInfo.decimals;
    } catch (err) {
      console.error('Get decimals error:', err);
      return 0;
    }
  }, [connection]);

  const handleSendTip = useCallback(async () => {
    if (!publicKey || !provider || !program) {
      setError('Wallet or program not initialized');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    console.log('Sending tip:', { recipient, amount, tokenMint, logOnChain });

    try {
      const balance = await connection.getBalance(publicKey);
      console.log('Sender balance:', balance / 1e9, 'SOL');

      const recipientPubkey = new PublicKey(recipient);
      const mintPubkey = tokenMint ? new PublicKey(tokenMint) : SystemProgram.programId;
      const decimals = await getTokenDecimals(mintPubkey);
      const amountBN = new BN(Number(amount) * (10 ** decimals));

      const isSol = mintPubkey.equals(SystemProgram.programId);

      const transferTx = new Transaction();
      if (isSol) {
        transferTx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: amountBN,
          })
        );
      } else {
        const senderAta = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
        const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientAtaInfo) {
          transferTx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              recipientAta,
              recipientPubkey,
              mintPubkey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }
        transferTx.add(
          createTransferInstruction(
            senderAta,
            recipientAta,
            publicKey,
            amountBN,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      const transferSig = await provider.sendAndConfirm(transferTx);
      console.log('Transfer Sig:', transferSig);
      setSuccess('Transfer successful');

      const balanceAfter = await connection.getBalance(publicKey);
      console.log('Sender balance after transfer:', balanceAfter / 1e9, 'SOL');

      if (logOnChain) {
        const [tipPda, bump] = PublicKey.findProgramAddressSync(
          [Buffer.from('tip'), publicKey.toBuffer(), recipientPubkey.toBuffer()],
          PROGRAM_ID
        );
        console.log('Tip PDA:', tipPda.toBase58(), 'Bump:', bump);

        const accounts: any = {
          tip: tipPda,
          sender: publicKey,
          recipient: recipientPubkey,
          systemProgram: SystemProgram.programId,
          mint: isSol ? null : mintPubkey,
          senderTokenAccount: isSol ? null : await getAssociatedTokenAddress(mintPubkey, publicKey),
          recipientTokenAccount: isSol ? null : await getAssociatedTokenAddress(mintPubkey, recipientPubkey),
          tokenProgram: isSol ? null : TOKEN_PROGRAM_ID,
          associatedTokenProgram: isSol ? null : ASSOCIATED_TOKEN_PROGRAM_ID,
        };

        console.log('Logging accounts:', {
          tip: accounts.tip.toBase58(),
          sender: accounts.sender.toBase58(),
          recipient: accounts.recipient.toBase58(),
          systemProgram: accounts.systemProgram.toBase58(),
          mint: accounts.mint ? accounts.mint.toBase58() : null,
          senderTokenAccount: accounts.senderTokenAccount ? accounts.senderTokenAccount.toBase58() : null,
          recipientTokenAccount: accounts.recipientTokenAccount ? accounts.recipientTokenAccount.toBase58() : null,
          tokenProgram: accounts.tokenProgram ? accounts.tokenProgram.toBase58() : null,
          associatedTokenProgram: accounts.associatedTokenProgram ? accounts.associatedTokenProgram.toBase58() : null,
        });

        const logSig = await program.methods
          .sendTip(amountBN, mintPubkey)
          .accounts(accounts)
          .rpc();
        console.log('Log Sig:', logSig);

        const tipAccount = await connection.getAccountInfo(tipPda);
        console.log('Tip account after logging:', tipAccount ? tipAccount.data.length : 'Not found');
      }

      await fetchAllTips();
    } catch (err: any) {
      console.error('Send tip error:', err);
      const errorMap: { [code: number]: string } = {
        6000: 'Invalid recipient address',
        6001: 'Amount must be greater than zero',
        6002: 'Cannot tip yourself',
        6003: 'Insufficient funds',
      };
      const errorCode = err.logs?.find((log: string) => log.includes('ProgramError'))?.match(/Error Code: (\w+)/)?.[1];
      const errorMsg = errorCode ? errorMap[parseInt(errorCode.slice(-4))] || err.message : err.message;
      setError(errorMsg || 'Transaction failed');
      await fetchAllTips();
    } finally {
      setLoading(false);
    }
  }, [publicKey, provider, program, recipient, amount, tokenMint, logOnChain, connection, fetchAllTips, getTokenDecimals]);

  const aggregateLeaderboards = useMemo(() => {
    const senderTotals: { [key: string]: BN } = {};
    allTips.forEach(tip => {
      const senderStr = tip.sender.toBase58();
      senderTotals[senderStr] = (senderTotals[senderStr] || new BN(0)).add(tip.amount);
    });
    return Object.entries(senderTotals)
      .sort(([, a], [, b]) => b.cmp(a))
      .slice(0, 10);
  }, [allTips]);

  const getBadge = (tips: TipData[]) => {
    const totalCount = tips.reduce((sum, tip) => sum.add(tip.tipCount), new BN(0));
    return totalCount.gte(new BN(BADGE_THRESHOLD)) ? '🏆 Tipper Badge' : '';
  };

  return (
    <ErrorBoundary>
      {publicKey ? (
        <Box sx={{ p: 4 }}>
          <Typography variant="h4">TipLink MVP</Typography>
          <WalletMultiButton />
          {error && <Typography color="error">{error}</Typography>}
          {success && <Typography color="primary">{success}</Typography>}
          
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6">Send Tip</Typography>
            <TextField label="Recipient Address" value={recipient} onChange={e => setRecipient(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField label="Amount" value={amount} onChange={e => setAmount(e.target.value)} fullWidth sx={ { mb: 2 } } />
            <TextField label="Token Mint (blank for SOL)" value={tokenMint} onChange={e => setTokenMint(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <FormControlLabel control={<Checkbox checked={logOnChain} onChange={e => setLogOnChain(e.target.checked)} />} label="Log on-chain (for history, gamification)" />
            <Button variant="contained" onClick={handleSendTip} disabled={loading}>Send Tip</Button>
          </Paper>

          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mt: 4 }}>
            <Tab label="Sent Tips" />
            <Tab label="Received Tips" />
            <Tab label="Leaderboard" />
            <Tab label="DAO Features" />
          </Tabs>

          {tabValue === 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6">Sent Tips {getBadge(sentTips)}</Typography>
              <TipTable tips={sentTips} connection={connection} />
            </Paper>
          )}

          {tabValue === 1 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6">Received Tips {getBadge(receivedTips)}</Typography>
              <TipTable tips={receivedTips} connection={connection} />
            </Paper>
          )}

          {tabValue === 2 && (
            <Paper sx={ { p: 2, mt: 2 }}>
              <Typography variant="h6">Leaderboard (Top Tippers by Amount)</Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Sender</TableCell>
                      <TableCell>Total Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aggregateLeaderboards.map(([sender, total], i) => (
                      <TableRow key={sender}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{sender}</TableCell>
                        <TableCell>{total.toString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {tabValue === 3 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6">DAO-Managed Features</Typography>
              <Typography>Placeholder for DAO integration (e.g., via Squads or Realms). DAO can manage badge thresholds, reward distributions, or tip fees.</Typography>
            </Paper>
          )}
        </Box>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4">TipLink MVP</Typography>
          <WalletMultiButton />
        </Box>
      )}
    </ErrorBoundary>
  );
};

const TipTable: FC<{ tips: TipData[]; connection: web3.Connection }> = ({ tips, connection }) => {
  const [decimalsMap, setDecimalsMap] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchDecimals = async () => {
      const map: { [key: string]: number } = {};
      for (const tip of tips) {
        const mintStr = tip.tokenMint.toBase58();
        if (!map[mintStr]) {
          try {
            map[mintStr] = await (tip.tokenMint.equals(SystemProgram.programId) ? 9 : (await getMint(connection, tip.tokenMint)).decimals);
          } catch (err) {
            console.error('Fetch decimals error:', err);
            map[mintStr] = 0;
          }
        }
      }
      setDecimalsMap(map);
    };
    fetchDecimals();
  }, [tips, connection]);

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Recipient</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Token</TableCell>
            <TableCell>Timestamp</TableCell>
            <TableCell>Count</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tips.map((tip, i) => {
            const mintStr = tip.tokenMint.toBase58();
            const dec = decimalsMap[mintStr] || 0;
            const displayAmount = Number(tip.amount) / (10 ** dec);
            return (
              <TableRow key={i}>
                <TableCell>{tip.recipient.toBase58()}</TableCell>
                <TableCell>{displayAmount}</TableCell>
                <TableCell>{mintStr}</TableCell>
                <TableCell>{new Date(Number(tip.timestamp) * 1000).toLocaleString()}</TableCell>
                <TableCell>{tip.tipCount.toString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TipLink;