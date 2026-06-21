import type { Address } from 'viem'
import { hardhat, sepolia } from 'wagmi/chains'

type RedAddresses = { market: Address; token: Address }

export const ADDRESSES_POR_RED: Record<number, RedAddresses> = {
  [hardhat.id]: {
    market: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    token:  '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  [sepolia.id]: {
    market: '0x82FDdE6aBA52E2C66280B763aa447657431cB8D1',
    token:  '0xB285d8536c29056A72FF2153b24Ca6970714EDA6',
  },
}
