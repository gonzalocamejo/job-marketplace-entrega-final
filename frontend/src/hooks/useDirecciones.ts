import { useChainId } from 'wagmi'
import { ADDRESSES_POR_RED } from '../contrato/direcciones'
import type { Address } from 'viem'

const VACIO = { market: '' as Address, token: '' as Address }

export function useDirecciones() {
  const chainId = useChainId()
  return ADDRESSES_POR_RED[chainId] ?? VACIO
}
