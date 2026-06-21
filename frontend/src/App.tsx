import { useState } from 'react'
import { Container, Group } from '@mantine/core'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { ConectarPrompt } from './components/ConectarPrompt'
import { TableroTrabajos } from './paginas/TableroTrabajos'
import { DetalleTrabajo } from './paginas/DetalleTrabajo'
import { PublicarTrabajo } from './paginas/PublicarTrabajo'

type Pagina =
  | { tipo: 'tablero' }
  | { tipo: 'detalle'; jobId: bigint }
  | { tipo: 'publicar' }

export default function App() {
  const { isConnected, address } = useAccount()
  const [pagina, setPagina] = useState<Pagina>({ tipo: 'tablero' })

  if (!isConnected || !address) {
    return <ConectarPrompt />
  }

  const walletAddress = address as Address

  return (
    <Container size="lg" py="xl">
      <Group justify="flex-end" mb="md">
        <ConnectButton />
      </Group>

      {pagina.tipo === 'tablero' && (
        <TableroTrabajos
          onVerDetalle={(jobId) => setPagina({ tipo: 'detalle', jobId })}
          onPublicar={() => setPagina({ tipo: 'publicar' })}
        />
      )}

      {pagina.tipo === 'detalle' && (
        <DetalleTrabajo
          jobId={pagina.jobId}
          walletAddress={walletAddress}
          onVolver={() => setPagina({ tipo: 'tablero' })}
        />
      )}

      {pagina.tipo === 'publicar' && (
        <PublicarTrabajo
          onVolver={() => setPagina({ tipo: 'tablero' })}
          onCreado={() => setPagina({ tipo: 'tablero' })}
        />
      )}
    </Container>
  )
}
