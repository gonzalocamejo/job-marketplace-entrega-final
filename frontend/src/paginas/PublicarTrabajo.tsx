import { useState, useEffect } from 'react'
import {
  Title, Stack, TextInput, Textarea, NumberInput, Button,
  Text, Alert, Group, Paper,
} from '@mantine/core'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { parseUnits, type Address } from 'viem'
import { JOB_MARKETPLACE_ABI } from '../contrato/abi'
import { useDirecciones } from '../hooks/useDirecciones'

type Props = {
  onVolver: () => void
  onCreado: (jobId: bigint) => void
}

function mensajeError(err: unknown): string {
  if (!err) return ''
  const e = err as { shortMessage?: string; message?: string }
  return e.shortMessage ?? e.message ?? String(err)
}

export function PublicarTrabajo({ onVolver, onCreado }: Props) {
  const queryClient = useQueryClient()
  const { market: MARKET_ADDRESS } = useDirecciones()

  const [descripcion, setDescripcion] = useState('')
  const [budget, setBudget] = useState<number | string>('')
  const [evaluador, setEvaluador] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [diasExpiracion, setDiasExpiracion] = useState<number | string>(7)

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess && receipt) {
      queryClient.invalidateQueries({ queryKey: ['trabajos'] })
      // Extraer jobId del evento JobCreated del receipt
      // El primer log del marketplace debería ser JobCreated con el jobId como primer arg indexed
      // Por simpleza, redirigimos al tablero y el usuario puede hacer clic en el nuevo job
      onCreado(0n) // placeholder — en producción parsearíamos el log
    }
  }, [isSuccess, receipt, queryClient, onCreado])

  const handleSubmit = () => {
    if (!descripcion.trim() || !budget || !evaluador.trim()) return

    const budgetWei = parseUnits(String(budget), 18)
    const dias = Number(diasExpiracion) || 7
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + dias * 86400)

    writeContract({
      address: MARKET_ADDRESS,
      abi: JOB_MARKETPLACE_ABI,
      functionName: 'createJob',
      args: [
        descripcion,
        budgetWei,
        evaluador.trim() as Address,
        proveedor.trim() ? (proveedor.trim() as Address) : '0x0000000000000000000000000000000000000000',
        expiresAt,
      ],
    })
  }

  const evaluadorTrimmed = evaluador.trim()
  const formularioValido =
    descripcion.trim().length > 0 &&
    Number(budget) > 0 &&
    evaluadorTrimmed.length === 42 &&
    evaluadorTrimmed.startsWith('0x')

  return (
    <Stack gap="lg">
      <Group>
        <Button variant="subtle" onClick={onVolver}>← Volver</Button>
        <Title order={2}>Publicar Trabajo</Title>
      </Group>

      <Paper withBorder p="md" shadow="xs">
        <Stack gap="md">
          <Textarea
            label="Descripción"
            placeholder="Describí el trabajo a realizar…"
            required
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.currentTarget.value)}
          />

          <NumberInput
            label="Presupuesto (JTK)"
            placeholder="100"
            required
            min={0.000001}
            decimalScale={6}
            value={budget}
            onChange={setBudget}
          />

          <TextInput
            label="Dirección del Evaluador"
            placeholder="0x... (puede ser el Multisig)"
            required
            value={evaluador}
            onChange={(e) => setEvaluador(e.currentTarget.value)}
            description="El evaluador aprueba o rechaza el entregable. Podés pegar la dirección del Multisig."
          />

          <TextInput
            label="Dirección del Proveedor (opcional)"
            placeholder="0x... (dejá vacío para asignar después)"
            value={proveedor}
            onChange={(e) => setProveedor(e.currentTarget.value)}
          />

          <NumberInput
            label="Días hasta expiración"
            placeholder="7"
            required
            min={1}
            max={365}
            value={diasExpiracion}
            onChange={setDiasExpiracion}
          />

          {writeError && (
            <Alert color="red" title="Error al crear trabajo">
              {mensajeError(writeError)}
            </Alert>
          )}

          {isSuccess && (
            <Alert color="green" title="Trabajo creado con éxito">
              La transacción fue confirmada. Volvé al tablero para verlo.
            </Alert>
          )}

          <Button
            onClick={handleSubmit}
            loading={isPending || isConfirming}
            disabled={!formularioValido}
            fullWidth
          >
            {isPending ? 'Confirmando en wallet…' : isConfirming ? 'Esperando confirmación…' : 'Publicar Trabajo'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
