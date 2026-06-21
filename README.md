# Job Marketplace — Entrega Final Taller 2

Marketplace de empleos sobre Ethereum inspirado en ERC-8183. El pago va en un token ERC-20 que se define al momento del deploy. Los fondos quedan en escrow en el contrato hasta que el evaluador aprueba o rechaza.

## Direcciones en Sepolia

MockERC20 (JTK): 0xB285d8536c29056A72FF2153b24Ca6970714EDA6

JobMarketplace: 0x82FDdE6aBA52E2C66280B763aa447657431cB8D1

Multisig: 0xEd58c3ECcB1b77588aC78FdCaeC9Fcc84f38750D

## Cómo correr los tests

```bash
npm install
npx hardhat test
```

Tienen que pasar 26 tests. Cubren el happy path completo, los tres tipos de rechazo, expiración, control de acceso por rol, el Multisig como evaluador con threshold 2-de-2, y varios casos borde.

## Cómo levantar el frontend localmente

Previamente tenemos que deployar los contratos:

```bash
# terminal 1
npx hardhat node

# terminal 2
npx hardhat run scripts/desplegar.ts --network localhost
```

El script imprime las direcciones. Copiarlas a `frontend/.env` con las variables `VITE_JOB_MARKETPLACE_ADDRESS` y `VITE_ERC20_TOKEN_ADDRESS`. El `.env.example` tiene la estructura completa.

Para fondear tu wallet con ETH y tokens JTK en la red local, ponés tu dirección en `FONDEAR_WALLET` dentro del `.env` y corrés:

```bash
npx hardhat run scripts/fondear-cuenta.ts --network localhost
```

Eso manda 10 ETH y 1000 JTK a la dirección que configures. El nodo tiene que estar corriendo cuando ejecutás este comando.

Después:

```bash
cd frontend
npm install
npm run dev
```

## Deploy en Sepolia

Completar `SEPOLIA_RPC_URL` y `PRIVATE_KEY` en `.env` y correr:

```bash
npx hardhat run scripts/desplegar.ts --network sepolia
```

## Decisiones de diseño

**Estado Refunded:** En la letra se habla de un solo estado Rejected para todo tipo de rechazo. Se separó en Rejected (cliente cancela en Open, sin fondos) y Refunded (evaluador rechaza en Funded o Submitted, con reembolso). Así el frontend puede mostrar badges distintos según si hubo devolución o no.

**Lista de trabajos:** se llama a getJobsCount() y luego getJob(i) para cada trabajo. La alternativa de leer eventos JobCreated falla en providers como Alchemy porque getLogs con fromBlock: 0 excede el límite de rango del free tier. El enfoque con lecturas directas funciona con cualquier RPC y además devuelve el estado actual sin necesitar reconstruirlo desde eventos.

**Entregables:** el contenido se guarda en localStorage y el hash keccak256 se registra on-chain. La capa de storage está aislada en `src/entregables/almacen.ts` para poder cambiarla a IPFS o una DB sin tocar nada más.

**nonReentrant en fund:** Se agregó porque fund llama a safeTransferFrom y se pide aplicar el guard donde haya interacciones externas.

**JobCreated con description y expiresAt:** Sin ellos el frontend no puede listar trabajos leyendo solo ese evento, que es lo que se solicitó en esta entrega.

**JobRejected:** Si no estuviera, se emitiría JobRefunded también cuando el cliente rechaza en Open, donde no hay ningún reembolso. Lo separamos en dos eventos con la semántica correcta.

**SafeERC20 y ReentrancyGuard de OpenZeppelin:** reemplazan la interfaz mínima y el guard custom del original. Más robusto con tokens no estándar.

**Routing:** navegación por useState sin react-router para no agregar dependencias, consistente con la Entrega 1.

**claimRefund sin control de acceso:** cualquiera puede llamar esta función, no solo el cliente. Si solo el cliente pudiera reclamar y perdiera acceso a su wallet, los fondos quedarían bloqueados para siempre. Al dejarlo abierto, el reembolso siempre es ejecutable. La spec lo pide explícitamente por este motivo.

**Sin owner ni admin en el contrato:** no existe ninguna dirección privilegiada que pueda pausar el contrato, cambiar reglas o sacar fondos. Una vez deployado, las reglas son fijas y la dirección del token es immutable. Cualquier admin sería un punto de confianza que rompe el modelo de escrow neutral.

**Budget inmutable:** el presupuesto se fija al crear el trabajo y no puede modificarse después. Evita que el cliente baje el monto una vez que el proveedor ya empezó a trabajar.

**deliverableRef y reason como bytes32:** guardar el contenido del entregable en la blockchain sería extremadamente caro en gas. En cambio se guarda el hash keccak256 del contenido (32 bytes fijos), que actúa como prueba de existencia. El contenido real vive off-chain. Lo mismo aplica al campo reason en complete y reject.

**Approve previo al fund:** el estándar ERC-20 no permite que un contrato mueva tokens de tu cuenta sin que vos lo autorices primero. Por eso fondear requiere dos transacciones: primero approve y después fund. Es una restricción del protocolo, no una decisión propia, pero explica por qué el frontend tiene ese flujo en dos pasos.

**Provider opcional en createJob:** el cliente puede publicar el trabajo sin saber todavía quién lo va a ejecutar y asignarlo después con setProvider. Permite un flujo donde primero se publica la oferta y luego se negocia con candidatos.

**Hardhat en lugar de Foundry:** se eligió Hardhat para mantener consistencia con el stack de la Entrega 2, que ya lo usaba con la misma versión y configuración.
