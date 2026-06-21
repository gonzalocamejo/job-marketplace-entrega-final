import { Badge } from '@mantine/core'

// Debe coincidir con el enum JobState del contrato
export const ESTADOS = [
  'Abierto',
  'Fondeado',
  'Entregado',
  'Completado',
  'Rechazado',
  'Reembolsado',
  'Expirado',
] as const

const COLORES: Record<number, string> = {
  0: 'blue',
  1: 'yellow',
  2: 'orange',
  3: 'green',
  4: 'red',
  5: 'grape',
  6: 'gray',
}

export function BadgeEstado({ state }: { state: number }) {
  return (
    <Badge color={COLORES[state] ?? 'gray'} variant="light">
      {ESTADOS[state] ?? `Estado ${state}`}
    </Badge>
  )
}
