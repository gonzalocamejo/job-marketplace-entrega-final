export const JOB_MARKETPLACE_ABI = [
  // ── Funciones de escritura ────────────────────────────────────────────────
  {
    name: 'createJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'description', type: 'string' },
      { name: 'budget', type: 'uint256' },
      { name: 'evaluator', type: 'address' },
      { name: 'provider', type: 'address' },
      { name: 'expiresAt', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setProvider',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'provider', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'fund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'submit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'deliverableRef', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'complete',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'reject',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'claimRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  // ── Funciones de lectura ──────────────────────────────────────────────────
  {
    name: 'getJobsCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getJob',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'client', type: 'address' },
          { name: 'evaluator', type: 'address' },
          { name: 'provider', type: 'address' },
          { name: 'budget', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'description', type: 'string' },
          { name: 'state', type: 'uint8' },
          { name: 'deliverableRef', type: 'bytes32' },
          { name: 'resolutionReason', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'token',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // ── Eventos ───────────────────────────────────────────────────────────────
  {
    name: 'JobCreated',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'evaluator', type: 'address', indexed: false },
      { name: 'provider', type: 'address', indexed: false },
      { name: 'budget', type: 'uint256', indexed: false },
      { name: 'description', type: 'string', indexed: false },
      { name: 'expiresAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ProviderAssigned',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
    ],
  },
  {
    name: 'JobFunded',
    type: 'event',
    inputs: [{ name: 'jobId', type: 'uint256', indexed: true }],
  },
  {
    name: 'JobSubmitted',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'deliverableRef', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'JobCompleted',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'reason', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'JobRejected',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'reason', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'JobRefunded',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'reason', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'JobExpired',
    type: 'event',
    inputs: [{ name: 'jobId', type: 'uint256', indexed: true }],
  },
  // ── Errores personalizados ────────────────────────────────────────────────
  { name: 'SeRequiereCliente', type: 'error', inputs: [] },
  { name: 'SeRequiereEvaluador', type: 'error', inputs: [] },
  { name: 'SeRequiereProvider', type: 'error', inputs: [] },
  { name: 'RolInvalido', type: 'error', inputs: [] },
  { name: 'TrabajoYaTieneProvedor', type: 'error', inputs: [] },
  { name: 'EstadoInvalido', type: 'error', inputs: [] },
  { name: 'ParaRechazarSeDebeSerClienteOEvaluador', type: 'error', inputs: [] },
  { name: 'ParaReclamarDebeEstarExpirado', type: 'error', inputs: [] },
  { name: 'TokenInvalida', type: 'error', inputs: [] },
  { name: 'JobInexistente', type: 'error', inputs: [] },
] as const
