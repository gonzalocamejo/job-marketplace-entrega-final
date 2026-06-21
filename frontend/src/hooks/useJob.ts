import { useReadContract, useChainId } from 'wagmi'
import { ADDRESSES_POR_RED } from '../contrato/direcciones'
import { JOB_MARKETPLACE_ABI } from '../contrato/abi'
import type { Address } from 'viem'

export type DetallesTrabajo = {
  client: Address
  evaluator: Address
  provider: Address
  budget: bigint
  expiresAt: bigint
  description: string
  state: number
  deliverableRef: `0x${string}`
  resolutionReason: `0x${string}`
}

export function useJob(jobId: bigint) {
  const chainId = useChainId()
  const addrs = ADDRESSES_POR_RED[chainId]

  const result = useReadContract({
    address: addrs?.market,
    abi: JOB_MARKETPLACE_ABI,
    functionName: 'getJob',
    args: [jobId],
    query: {
      refetchInterval: 8_000,
      enabled: !!addrs?.market,
    },
  })

  return {
    job: result.data as DetallesTrabajo | undefined,
    isLoading: result.isLoading,
    isError: result.isError,
    refetch: result.refetch,
  }
}
