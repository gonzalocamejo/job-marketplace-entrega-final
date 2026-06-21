import {
  Title, Stack, Card, Text, Group, Badge, Button, Loader, Alert, SimpleGrid,
} from '@mantine/core'
import { useTrabajos } from '../hooks/useTrabajos'
import { BadgeEstado } from '../components/BadgeEstado'
import { formatUnits } from 'viem'

type Props = {
  onVerDetalle: (jobId: bigint) => void
  onPublicar: () => void
}

export function TableroTrabajos({ onVerDetalle, onPublicar }: Props) {
  const { data: trabajos, isLoading, isError, refetch } = useTrabajos()

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Tablero de Trabajos</Title>
        <Button onClick={onPublicar}>+ Publicar Trabajo</Button>
      </Group>

      {isLoading && (
        <Group justify="center" py="xl">
          <Loader />
          <Text c="dimmed">Cargando trabajos…</Text>
        </Group>
      )}

      {isError && (
        <Alert color="red" title="Error al cargar trabajos">
          No se pudo conectar al contrato. Verificá que la dirección sea correcta
          y que estés en la red Sepolia.
          <Button variant="subtle" size="xs" mt="xs" onClick={() => refetch()}>
            Reintentar
          </Button>
        </Alert>
      )}

      {!isLoading && !isError && trabajos?.length === 0 && (
        <Alert color="blue" title="Sin trabajos">
          Todavía no hay trabajos publicados. ¡Sé el primero!
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {trabajos?.map((t) => (
          <Card
            key={t.jobId.toString()}
            shadow="xs"
            withBorder
            padding="md"
            style={{ cursor: 'pointer' }}
            onClick={() => onVerDetalle(t.jobId)}
          >
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap">
                <Badge variant="outline" color="gray" size="sm">
                  #{t.jobId.toString()}
                </Badge>
                <BadgeEstado state={t.state} />
              </Group>

              <Text fw={600} lineClamp={2} size="sm">
                {t.description}
              </Text>

              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  {t.client.slice(0, 6)}…{t.client.slice(-4)}
                </Text>
                <Text fw={500} size="sm">
                  {formatUnits(t.budget, 18)} JTK
                </Text>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
