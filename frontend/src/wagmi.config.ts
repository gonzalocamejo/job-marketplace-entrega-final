import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, hardhat } from 'wagmi/chains'
import { http } from 'wagmi'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string
const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL as string

export const wagmiConfig = getDefaultConfig({
  appName: 'Job Marketplace — Taller 2',
  projectId,
  chains: [hardhat, sepolia],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(rpcUrl),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
