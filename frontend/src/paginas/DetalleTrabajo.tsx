import {
  Title, Stack, Text, Group, Paper, Divider, Button, Loader, Alert,
  Anchor,
} from '@mantine/core'
import { formatUnits } from 'viem'
import type { Address } from 'viem'
import { useJob } from '../hooks/useJob'
import { BadgeEstado } from '../components/BadgeEstado'
import { PanelAcciones } from '../components/PanelAcciones'
import { obtenerEntregable } from '../entregables/almacen'

type Props = {
  jobId: bigint
  walletAddress: Address
  onVolver: () => void
}

function DireccionCorta({ addr }: { addr: string }) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    return <Text c="dimmed" size="sm">No asignado</Text>
  }
  return (
    <Text size="sm" ff="monospace">
      {addr}
    </Text>
  )
}

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text c="dimmed" size="sm" style={{ minWidth: 130 }}>{label}</Text>
      <div style={{ textAlign: 'right' }}>{children}</div>
    </Group>
  )
}

export function DetalleTrabajo({ jobId, walletAddress, onVolver }: Props) {
  const { job, isLoading, isError, refetch } = useJob(jobId)

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
        <Text c="dimmed">Cargando trabajo #{jobId.toString()}…</Text>
      </Group>
    )
  }

  if (isError || !job) {
    return (
      <Alert color="red" title="Error">
        No se pudo cargar el trabajo.
        <Button variant="subtle" size="xs" mt="xs" onClick={() => refetch()}>
          Reintentar
        </Button>
      </Alert>
    )
  }

  const fechaExpiracion = new Date(Number(job.expiresAt) * 1000).toLocaleString('es-AR')
  const entregableLocal = job.deliverableRef !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    ? obtenerEntregable(job.deliverableRef)
    : null

  return (
    <Stack gap="lg">
      <Group>
        <Button variant="subtle" onClick={onVolver}>← Volver</Button>
        <Title order={2}>Trabajo #{jobId.toString()}</Title>
        <BadgeEstado state={job.state} />
      </Group>

      <Paper withBorder p="md" shadow="xs">
        <Stack gap="sm">
          <Text fw={600} size="lg">{job.description}</Text>
          <Divider />

          <Fila label="Presupuesto">
            <Text fw={600}>{formatUnits(job.budget, 18)} JTK</Text>
          </Fila>

          <Fila label="Cliente">
            <DireccionCorta addr={job.client} />
          </Fila>

          <Fila label="Evaluador">
            <DireccionCorta addr={job.evaluator} />
          </Fila>

          <Fila label="Proveedor">
            <DireccionCorta addr={job.provider} />
          </Fila>

          <Fila label="Expira">
            <Text size="sm">{fechaExpiracion}</Text>
          </Fila>

          {job.deliverableRef !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
            <Fila label="Entregable (ref)">
              <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
                {job.deliverableRef}
              </Text>
            </Fila>
          )}

          {entregableLocal && (
            <Fila label="Entregable (contenido)">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', maxWidth: 400 }}>
                {entregableLocal}
              </Text>
            </Fila>
          )}

          {job.resolutionReason !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
            <Fila label="Resolución">
              <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
                {job.resolutionReason}
              </Text>
            </Fila>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md" shadow="xs">
        <Title order={4} mb="md">Acciones</Title>
        <PanelAcciones jobId={jobId} job={job} walletAddress={walletAddress} />
      </Paper>
    </Stack>
  )
}
