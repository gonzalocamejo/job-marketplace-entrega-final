import { useQuery } from '@tanstack/react-query'
import { usePublicClient, useChainId } from 'wagmi'
import type { Address } from 'viem'
import { ADDRESSES_POR_RED } from '../contrato/direcciones'
import { JOB_MARKETPLACE_ABI } from '../contrato/abi'

export type ResumenTrabajo = {
  jobId: bigint
  client: Address
  evaluator: Address
  provider: Address
  budget: bigint
  description: string
  expiresAt: bigint
  state: number
}

export function useTrabajos() {
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const addrs = ADDRESSES_POR_RED[chainId]

  return useQuery<ResumenTrabajo[]>({
    queryKey: ['trabajos', chainId, addrs?.market],
    queryFn: async () => {
      if (!publicClient || !addrs?.market) return []

      const count = await publicClient.readContract({
        address: addrs.market,
        abi: JOB_MARKETPLACE_ABI,
        functionName: 'getJobsCount',
      })

      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i))

      const trabajos = await Promise.all(
        ids.map(async (jobId) => {
          const job = await publicClient.readContract({
            address: addrs.market,
            abi: JOB_MARKETPLACE_ABI,
            functionName: 'getJob',
            args: [jobId],
          })
          return {
            jobId,
            client:      job.client as Address,
            evaluator:   job.evaluator as Address,
            provider:    job.provider as Address,
            budget:      job.budget,
            description: job.description,
            expiresAt:   job.expiresAt,
            state:       job.state as number,
          }
        })
      )

      return trabajos.sort((a, b) => Number(b.jobId - a.jobId))
    },
    enabled: !!publicClient && !!addrs?.market,
    refetchInterval: 15_000,
  })
}
