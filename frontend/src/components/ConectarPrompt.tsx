import { Center, Stack, Title, Text } from '@mantine/core'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function ConectarPrompt() {
  return (
    <Center h="100vh">
      <Stack align="center" gap="lg">
        <Title order={1}>Job Marketplace</Title>
        <Text c="dimmed">Conectá tu wallet para acceder al marketplace</Text>
        <ConnectButton />
      </Stack>
    </Center>
  )
}
