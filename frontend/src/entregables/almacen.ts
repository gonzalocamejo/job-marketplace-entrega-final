import { keccak256, toHex } from 'viem'

const PREFIX = 'entregable:'

/** Convierte el contenido de un entregable a un bytes32 (keccak256). */
export function contenidoABytes32(contenido: string): `0x${string}` {
  return keccak256(toHex(contenido))
}

/** Guarda el contenido del entregable en localStorage, indexado por su hash. */
export function guardarEntregable(hash: `0x${string}`, contenido: string): void {
  localStorage.setItem(PREFIX + hash, contenido)
}

/** Recupera el contenido de un entregable a partir de su hash. */
export function obtenerEntregable(hash: `0x${string}`): string | null {
  return localStorage.getItem(PREFIX + hash)
}
