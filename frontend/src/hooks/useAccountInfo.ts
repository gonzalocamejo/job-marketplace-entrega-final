import { useAccount } from 'wagmi'

export function useAccountInfo() {
  const { address, isConnected } = useAccount()
  const displayName = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : undefined
  return { address, displayName, isConnected }
}
