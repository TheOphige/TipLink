import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, SystemProgram } from '@solana/spl-token';
import { FC, useEffect, useState } from 'react';

interface TipData {
  sender: PublicKey;
  recipient: PublicKey;
  amount: string | import('@coral-xyz/anchor').BN;
  tokenMint: PublicKey;
  timestamp: string | import('@coral-xyz/anchor').BN;
  tipCount: string | import('@coral-xyz/anchor').BN;
}

const TipTable: FC<{ tips: TipData[]; connection: Connection }> = ({ tips, connection }) => {
  const [decimalsMap, setDecimalsMap] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchDecimals = async () => {
      const map: { [key: string]: number } = {};
      for (const tip of tips) {
        const mintStr = tip.tokenMint.toBase58();
        if (!map[mintStr]) {
          map[mintStr] = await (tip.tokenMint.equals(SystemProgram.programId) ? 9 : (await getMint(connection, tip.tokenMint)).decimals);
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

export default TipTable;