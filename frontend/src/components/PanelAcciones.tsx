import { useState, useEffect } from 'react'
import {
  Stack, Button, TextInput, Textarea, Text, Alert, Group,
} from '@mantine/core'
import {
  useWriteContract, useWaitForTransactionReceipt, useReadContract,
} from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { JOB_MARKETPLACE_ABI } from '../contrato/abi'
import { ERC20_ABI } from '../contrato/abiToken'
import { useDirecciones } from '../hooks/useDirecciones'
import { contenidoABytes32, guardarEntregable } from '../entregables/almacen'
import type { DetallesTrabajo } from '../hooks/useJob'

const OPEN = 0
const FUNDED = 1
const SUBMITTED = 2
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

function mensajeError(err: unknown): string {
  if (!err) return ''
  const e = err as { shortMessage?: string; message?: string }
  return e.shortMessage ?? e.message ?? String(err)
}

function useEscribir(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['trabajos'] })
      queryClient.invalidateQueries({ queryKey: ['job'] })
      onSuccess?.()
    }
  }, [isSuccess, queryClient, onSuccess])

  return { writeContract, isPending, isConfirming, isSuccess, writeError }
}

type Addrs = { market: Address; token: Address }

function AccionAsignarProveedor({ jobId, addrs }: { jobId: bigint; addrs: Addrs }) {
  const [addr, setAddr] = useState('')
  const { writeContract, isPending, isConfirming, isSuccess, writeError } = useEscribir()

  return (
    <Stack gap="xs">
      <TextInput
        label="Dirección del proveedor"
        placeholder="0x..."
        value={addr}
        onChange={(e) => setAddr(e.currentTarget.value)}
      />
      {writeError && <Text c="red" size="sm">{mensajeError(writeError)}</Text>}
      <Button
        loading={isPending || isConfirming}
        disabled={isSuccess}
        onClick={() =>
          writeContract({
            address: addrs.market,
            abi: JOB_MARKETPLACE_ABI,
            functionName: 'setProvider',
            args: [jobId, addr.trim() as Address],
          })
        }
        fullWidth
      >
        Asignar Proveedor
      </Button>
    </Stack>
  )
}

function AccionFondear({ jobId, budget, walletAddress, addrs }: {
  jobId: bigint; budget: bigint; walletAddress: Address; addrs: Addrs
}) {
  const queryClient = useQueryClient()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: addrs.token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [walletAddress, addrs.market],
  })

  const needsApprove = (allowance ?? 0n) < budget

  const { writeContract: doApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContract: doFund, data: fundHash, isPending: fundPending, error: fundError } = useWriteContract()
  const { isLoading: fundConfirming, isSuccess: fundSuccess } = useWaitForTransactionReceipt({ hash: fundHash })

  useEffect(() => {
    if (approveSuccess) refetchAllowance()
  }, [approveSuccess, refetchAllowance])

  useEffect(() => {
    if (fundSuccess) {
      queryClient.invalidateQueries({ queryKey: ['trabajos'] })
      queryClient.invalidateQueries({ queryKey: ['job'] })
    }
  }, [fundSuccess, queryClient])

  const error = approveError ?? fundError

  if (needsApprove) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">Primero debés aprobar la transferencia de tokens al contrato.</Text>
        {error && <Text c="red" size="sm">{mensajeError(error)}</Text>}
        <Button
          loading={approvePending || approveConfirming}
          disabled={approveSuccess}
          onClick={() => doApprove({ address: addrs.token, abi: ERC20_ABI, functionName: 'approve', args: [addrs.market, budget] })}
          fullWidth
        >
          {approveSuccess ? 'Aprobado — cargando...' : 'Aprobar tokens'}
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="xs">
      {error && <Text c="red" size="sm">{mensajeError(error)}</Text>}
      <Button
        color="yellow"
        loading={fundPending || fundConfirming}
        disabled={fundSuccess}
        onClick={() => doFund({ address: addrs.market, abi: JOB_MARKETPLACE_ABI, functionName: 'fund', args: [jobId] })}
        fullWidth
      >
        Fondear Trabajo
      </Button>
    </Stack>
  )
}

function AccionEnviarEntrega({ jobId, addrs }: { jobId: bigint; addrs: Addrs }) {
  const [contenido, setContenido] = useState('')
  const { writeContract, isPending, isConfirming, isSuccess, writeError } = useEscribir()

  const handleSubmit = () => {
    const hash = contenidoABytes32(contenido)
    guardarEntregable(hash, contenido)
    writeContract({ address: addrs.market, abi: JOB_MARKETPLACE_ABI, functionName: 'submit', args: [jobId, hash] })
  }

  return (
    <Stack gap="xs">
      <Textarea
        label="Contenido del entregable"
        placeholder="Descripción del entregable, link, etc."
        value={contenido}
        onChange={(e) => setContenido(e.currentTarget.value)}
        rows={4}
      />
      <Text size="xs" c="dimmed">El contenido se guarda localmente; el hash se registra en la blockchain.</Text>
      {writeError && <Text c="red" size="sm">{mensajeError(writeError)}</Text>}
      <Button color="orange" loading={isPending || isConfirming} disabled={!contenido.trim() || isSuccess} onClick={handleSubmit} fullWidth>
        Enviar Entrega
      </Button>
    </Stack>
  )
}

function AccionRechazar({ jobId, addrs }: { jobId: bigint; addrs: Addrs }) {
  const { writeContract, isPending, isConfirming, isSuccess, writeError } = useEscribir()
  return (
    <Stack gap="xs">
      {writeError && <Text c="red" size="sm">{mensajeError(writeError)}</Text>}
      <Button
        color="red" variant="outline" loading={isPending || isConfirming} disabled={isSuccess}
        onClick={() => writeContract({ address: addrs.market, abi: JOB_MARKETPLACE_ABI, functionName: 'reject', args: [jobId, ZERO_BYTES32] })}
        fullWidth
      >
        Rechazar
      </Button>
    </Stack>
  )
}

function AccionAprobar({ jobId, addrs }: { jobId: bigint; addrs: Addrs }) {
  const { writeContract, isPending, isConfirming, isSuccess, writeError } = useEscribir()
  return (
    <Stack gap="xs">
      {writeError && <Text c="red" size="sm">{mensajeError(writeError)}</Text>}
      <Button
        color="green" loading={isPending || isConfirming} disabled={isSuccess}
        onClick={() => writeContract({ address: addrs.market, abi: JOB_MARKETPLACE_ABI, functionName: 'complete', args: [jobId, ZERO_BYTES32] })}
        fullWidth
      >
        Aprobar y Liberar Fondos
      </Button>
    </Stack>
  )
}

function AccionReclamarReembolso({ jobId, addrs }: { jobId: bigint; addrs: Addrs }) {
  const { writeContract, isPending, isConfirming, isSuccess, writeError } = useEscribir()
  return (
    <Stack gap="xs">
      {writeError && <Text c="red" size="sm">{mensajeError(writeError)}</Text>}
      <Button
        color="grape" loading={isPending || isConfirming} disabled={isSuccess}
        onClick={() => writeContract({ address: addrs.market, abi: JOB_MARKETPLACE_ABI, functionName: 'claimRefund', args: [jobId] })}
        fullWidth
      >
        Reclamar Reembolso
      </Button>
    </Stack>
  )
}

export function PanelAcciones({ jobId, job, walletAddress }: {
  jobId: bigint
  job: DetallesTrabajo
  walletAddress: Address
}) {
  const addrs = useDirecciones()
  const ahora = BigInt(Math.floor(Date.now() / 1000))
  const expirado = ahora > job.expiresAt
  const esCliente = walletAddress.toLowerCase() === job.client.toLowerCase()
  const esEvaluador = walletAddress.toLowerCase() === job.evaluator.toLowerCase()
  const esProvider = walletAddress.toLowerCase() === job.provider.toLowerCase()
  const tieneProvider = job.provider !== '0x0000000000000000000000000000000000000000'

  if (expirado && (job.state === FUNDED || job.state === SUBMITTED)) {
    return (
      <Stack gap="md">
        <Alert color="orange" title="Trabajo expirado">
          El plazo venció. Cualquiera puede reclamar el reembolso al cliente.
        </Alert>
        <AccionReclamarReembolso jobId={jobId} addrs={addrs} />
      </Stack>
    )
  }

  if (esCliente && job.state === OPEN) {
    return (
      <Stack gap="md">
        {!tieneProvider && <AccionAsignarProveedor jobId={jobId} addrs={addrs} />}
        {tieneProvider && <AccionFondear jobId={jobId} budget={job.budget} walletAddress={walletAddress} addrs={addrs} />}
        <AccionRechazar jobId={jobId} addrs={addrs} />
      </Stack>
    )
  }

  if (esProvider && job.state === FUNDED) {
    return <AccionEnviarEntrega jobId={jobId} addrs={addrs} />
  }

  if (esEvaluador && job.state === SUBMITTED) {
    return (
      <Group grow>
        <AccionAprobar jobId={jobId} addrs={addrs} />
        <AccionRechazar jobId={jobId} addrs={addrs} />
      </Group>
    )
  }

  return (
    <Text c="dimmed" size="sm">
      No hay acciones disponibles para tu wallet en el estado actual.
    </Text>
  )
}
