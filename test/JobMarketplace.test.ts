import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  JobMarketplace,
  MockERC20,
  Multisig,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const BUDGET = ethers.parseUnits("100", 18);
const REASON = ethers.encodeBytes32String("aprobado");
const REASON_REJECT = ethers.encodeBytes32String("rechazado");
const DELIVERABLE = ethers.encodeBytes32String("QmHash123");
const ZERO_BYTES = ethers.ZeroHash;
const ONE_HOUR = 3600;

async function deploy() {
  const [owner, client, evaluator, provider, stranger] =
    await ethers.getSigners();

  const Token = await ethers.getContractFactory("MockERC20");
  const token = (await Token.deploy(
    "Test Token",
    "TST",
    owner.address
  )) as MockERC20;

  const Market = await ethers.getContractFactory("JobMarketplace");
  const market = (await Market.deploy(
    await token.getAddress()
  )) as JobMarketplace;

  // Acuñar tokens al cliente para los tests
  await token.mint(client.address, ethers.parseUnits("1000", 18));

  return { token, market, owner, client, evaluator, provider, stranger };
}

/** Crea un job y devuelve su ID */
async function createJobHelper(
  market: JobMarketplace,
  client: HardhatEthersSigner,
  evaluator: HardhatEthersSigner,
  providerAddr: string = ethers.ZeroAddress,
  expireOffset: number = ONE_HOUR
) {
  const expiresAt = (await time.latest()) + expireOffset;
  const tx = await market
    .connect(client)
    .createJob("Descripcion de prueba", BUDGET, evaluator.address, providerAddr, expiresAt);
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((l) => {
      try {
        return market.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "JobCreated");
  return event!.args.jobId as bigint;
}

/** Aprueba + fondea un job ya creado */
async function fundJobHelper(
  market: JobMarketplace,
  token: MockERC20,
  client: HardhatEthersSigner,
  jobId: bigint
) {
  await token.connect(client).approve(await market.getAddress(), BUDGET);
  await market.connect(client).fund(jobId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HAPPY PATH
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — happy path", () => {
  it("crear → fondear → entregar → completar: provider recibe budget", async () => {
    const { token, market, client, evaluator, provider } = await deploy();

    // 1. Crear job con provider ya asignado
    const jobId = await createJobHelper(market, client, evaluator, provider.address);

    // 2. Fondear
    await fundJobHelper(market, token, client, jobId);
    expect((await market.getJob(jobId)).state).to.equal(1); // Funded

    // 3. Entregar
    await market.connect(provider).submit(jobId, DELIVERABLE);
    expect((await market.getJob(jobId)).state).to.equal(2); // Submitted

    // 4. Completar — el provider debe recibir el budget
    const prevBalance = await token.balanceOf(provider.address);
    await market.connect(evaluator).complete(jobId, REASON);
    const newBalance = await token.balanceOf(provider.address);

    expect(newBalance - prevBalance).to.equal(BUDGET);
    expect((await market.getJob(jobId)).state).to.equal(3); // Completed
  });

  it("createJob emite JobCreated con descripcion y expiresAt", async () => {
    const { market, client, evaluator } = await deploy();
    const expiresAt = (await time.latest()) + ONE_HOUR;
    await expect(
      market
        .connect(client)
        .createJob("desc test", BUDGET, evaluator.address, ethers.ZeroAddress, expiresAt)
    )
      .to.emit(market, "JobCreated")
      .withArgs(0n, client.address, evaluator.address, ethers.ZeroAddress, BUDGET, "desc test", expiresAt);
  });

  it("setProvider asigna proveedor en Open sin provider", async () => {
    const { market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);
    await expect(market.connect(client).setProvider(jobId, provider.address))
      .to.emit(market, "ProviderAssigned")
      .withArgs(jobId, provider.address);
    expect((await market.getJob(jobId)).provider).to.equal(provider.address);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECHAZO
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — rechazo", () => {
  it("cliente rechaza en Open: estado Rejected, sin transferencia", async () => {
    const { token, market, client, evaluator } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);

    const prevBalance = await token.balanceOf(client.address);
    await expect(market.connect(client).reject(jobId, REASON_REJECT))
      .to.emit(market, "JobRejected")
      .withArgs(jobId, REASON_REJECT);
    expect((await market.getJob(jobId)).state).to.equal(4); // Rejected
    // No se transfirieron fondos (el job nunca fue fondeado)
    expect(await token.balanceOf(client.address)).to.equal(prevBalance);
  });

  it("evaluador rechaza en Funded: estado Refunded, cliente recibe budget", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);

    const prevBalance = await token.balanceOf(client.address);
    await expect(market.connect(evaluator).reject(jobId, REASON_REJECT))
      .to.emit(market, "JobRefunded")
      .withArgs(jobId, REASON_REJECT);

    expect((await market.getJob(jobId)).state).to.equal(5); // Refunded
    expect(await token.balanceOf(client.address)).to.equal(prevBalance + BUDGET);
  });

  it("evaluador rechaza en Submitted: estado Refunded, cliente recibe budget", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    await market.connect(provider).submit(jobId, DELIVERABLE);

    const prevBalance = await token.balanceOf(client.address);
    await market.connect(evaluator).reject(jobId, REASON_REJECT);

    expect((await market.getJob(jobId)).state).to.equal(5); // Refunded
    expect(await token.balanceOf(client.address)).to.equal(prevBalance + BUDGET);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPIRACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — expiración", () => {
  it("claimRefund desde Funded luego de expiresAt: cliente recupera fondos", async () => {
    const { token, market, client, evaluator, provider, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address, 60);
    await fundJobHelper(market, token, client, jobId);

    // Avanzar el tiempo más allá de expiresAt
    await time.increase(120);

    const prevBalance = await token.balanceOf(client.address);
    await expect(market.connect(stranger).claimRefund(jobId))
      .to.emit(market, "JobExpired")
      .withArgs(jobId);

    expect((await market.getJob(jobId)).state).to.equal(6); // Expired
    expect(await token.balanceOf(client.address)).to.equal(prevBalance + BUDGET);
  });

  it("claimRefund desde Submitted luego de expiresAt: cliente recupera fondos", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address, 60);
    await fundJobHelper(market, token, client, jobId);
    await market.connect(provider).submit(jobId, DELIVERABLE);

    await time.increase(120);

    const prevBalance = await token.balanceOf(client.address);
    await market.connect(stranger => stranger).claimRefund; // type-only check
    await market.claimRefund(jobId); // caller irrelevant — open a todos

    expect((await market.getJob(jobId)).state).to.equal(6); // Expired
    expect(await token.balanceOf(client.address)).to.equal(prevBalance + BUDGET);
  });

  it("claimRefund falla antes de expiresAt", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);

    await expect(market.claimRefund(jobId)).to.be.revertedWithCustomError(
      market,
      "ParaReclamarDebeEstarExpirado"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL DE ACCESO
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — control de acceso", () => {
  it("setProvider: revierte si no es el cliente", async () => {
    const { market, client, evaluator, provider, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);
    await expect(
      market.connect(stranger).setProvider(jobId, provider.address)
    ).to.be.revertedWithCustomError(market, "SeRequiereCliente");
  });

  it("fund: revierte si no es el cliente", async () => {
    const { token, market, client, evaluator, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);
    await token.connect(stranger); // stranger no tiene tokens/aprobación
    await expect(
      market.connect(stranger).fund(jobId)
    ).to.be.revertedWithCustomError(market, "SeRequiereCliente");
  });

  it("submit: revierte si no es el provider asignado", async () => {
    const { token, market, client, evaluator, provider, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    await expect(
      market.connect(stranger).submit(jobId, DELIVERABLE)
    ).to.be.revertedWithCustomError(market, "SeRequiereProvider");
  });

  it("complete: revierte si no es el evaluador", async () => {
    const { token, market, client, evaluator, provider, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    await market.connect(provider).submit(jobId, DELIVERABLE);
    await expect(
      market.connect(stranger).complete(jobId, REASON)
    ).to.be.revertedWithCustomError(market, "SeRequiereEvaluador");
  });

  it("reject: revierte si no es cliente ni evaluador", async () => {
    const { market, client, evaluator, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);
    await expect(
      market.connect(stranger).reject(jobId, REASON_REJECT)
    ).to.be.revertedWithCustomError(market, "ParaRechazarSeDebeSerClienteOEvaluador");
  });

  it("createJob: revierte sin evaluador (address cero)", async () => {
    const { market, client } = await deploy();
    await expect(
      market.connect(client).createJob(
        "desc",
        BUDGET,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        (await time.latest()) + ONE_HOUR
      )
    ).to.be.revertedWithCustomError(market, "SeRequiereEvaluador");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MULTISIG COMO EVALUADOR
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — Multisig como evaluador", () => {
  it("complete solo tiene éxito después de que el Multisig alcanza threshold y ejecuta", async () => {
    const [signer1, signer2, client, provider] = await ethers.getSigners();
    const threshold = 2n;

    // Desplegar token + marketplace
    const Token = await ethers.getContractFactory("MockERC20");
    const token = (await Token.deploy("Test Token", "TST", signer1.address)) as MockERC20;
    await token.mint(client.address, ethers.parseUnits("1000", 18));

    const Market = await ethers.getContractFactory("JobMarketplace");
    const market = (await Market.deploy(await token.getAddress())) as JobMarketplace;

    // Desplegar Multisig 2-de-2
    const Multi = await ethers.getContractFactory("Multisig");
    const multisig = (await Multi.deploy(
      [signer1.address, signer2.address],
      threshold
    )) as Multisig;

    // Crear job con el Multisig como evaluador
    const expiresAt = (await time.latest()) + ONE_HOUR;
    await market
      .connect(client)
      .createJob("Trabajo con multisig", BUDGET, await multisig.getAddress(), provider.address, expiresAt);

    const jobId = 0n;

    // Fondear
    await token.connect(client).approve(await market.getAddress(), BUDGET);
    await market.connect(client).fund(jobId);

    // Provider entrega
    await market.connect(provider).submit(jobId, DELIVERABLE);

    // Codificar la llamada a complete(jobId, reason)
    const callData = market.interface.encodeFunctionData("complete", [jobId, REASON]);
    const marketAddr = await market.getAddress();

    // El Multisig propone la transacción (signer1)
    await multisig.connect(signer1).Propuesta(marketAddr, callData);

    // 0 firmas → Ejecucion debe fallar
    await expect(
      multisig.connect(signer1).Ejecucion(0)
    ).to.be.revertedWithCustomError(multisig, "FirmasInsuficientes");

    expect((await market.getJob(jobId)).state).to.equal(2); // sigue en Submitted

    // signer1 firma → 1 firma, aún insuficiente para threshold 2
    await multisig.connect(signer1).Aprobacion(0);
    await expect(
      multisig.connect(signer1).Ejecucion(0)
    ).to.be.revertedWithCustomError(multisig, "FirmasInsuficientes");

    // signer2 firma → llega a threshold 2
    await multisig.connect(signer2).Aprobacion(0);

    // Ahora signer1 ejecuta → complete se llama desde el Multisig
    const prevProviderBalance = await token.balanceOf(provider.address);
    await multisig.connect(signer1).Ejecucion(0);

    expect((await market.getJob(jobId)).state).to.equal(3); // Completed
    expect(await token.balanceOf(provider.address)).to.equal(prevProviderBalance + BUDGET);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASOS BORDE
// ═══════════════════════════════════════════════════════════════════════════════
describe("JobMarketplace — casos borde", () => {
  it("doble fund revierte (ya no está en Open)", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    // Volver a aprobar e intentar fondear de nuevo
    await token.connect(client).approve(await market.getAddress(), BUDGET);
    await expect(
      market.connect(client).fund(jobId)
    ).to.be.revertedWithCustomError(market, "EstadoInvalido");
  });

  it("fund por no-client revierte", async () => {
    const { token, market, client, evaluator, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator);
    await token.mint(stranger.address, BUDGET);
    await token.connect(stranger).approve(await market.getAddress(), BUDGET);
    await expect(
      market.connect(stranger).fund(jobId)
    ).to.be.revertedWithCustomError(market, "SeRequiereCliente");
  });

  it("submit sin provider asignado (address cero) revierte", async () => {
    const { token, market, client, evaluator, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator); // sin provider
    await fundJobHelper(market, token, client, jobId);
    // stranger no es address(0), así que siempre falla el chequeo de rol
    await expect(
      market.connect(stranger).submit(jobId, DELIVERABLE)
    ).to.be.revertedWithCustomError(market, "SeRequiereProvider");
  });

  it("complete sobre job no Submitted revierte", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    // Estado es Funded, no Submitted
    await expect(
      market.connect(evaluator).complete(jobId, REASON)
    ).to.be.revertedWithCustomError(market, "EstadoInvalido");
  });

  it("setProvider revierte si el job ya tiene proveedor", async () => {
    const { market, client, evaluator, provider, stranger } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await expect(
      market.connect(client).setProvider(jobId, stranger.address)
    ).to.be.revertedWithCustomError(market, "TrabajoYaTieneProvedor");
  });

  it("cliente no puede rechazar en Funded (solo en Open)", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address);
    await fundJobHelper(market, token, client, jobId);
    // El cliente no puede rechazar en Funded; el reject del cliente requiere Open
    // Pero el dispatch va a _rejectCliente que tiene requiresStatus(Open) → EstadoInvalido
    await expect(
      market.connect(client).reject(jobId, REASON_REJECT)
    ).to.be.revertedWithCustomError(market, "EstadoInvalido");
  });

  it("claimRefund sobre job Completed revierte", async () => {
    const { token, market, client, evaluator, provider } = await deploy();
    const jobId = await createJobHelper(market, client, evaluator, provider.address, 60);
    await fundJobHelper(market, token, client, jobId);
    await market.connect(provider).submit(jobId, DELIVERABLE);
    await market.connect(evaluator).complete(jobId, REASON);
    // Avanzar tiempo
    await time.increase(120);
    await expect(
      market.claimRefund(jobId)
    ).to.be.revertedWithCustomError(market, "EstadoInvalido");
  });

  it("getJob revierte para jobId inexistente", async () => {
    const { market } = await deploy();
    await expect(market.getJob(999n)).to.be.revertedWithCustomError(
      market,
      "JobInexistente"
    );
  });

  it("getJobsCount incrementa con cada createJob", async () => {
    const { market, client, evaluator } = await deploy();
    expect(await market.getJobsCount()).to.equal(0n);
    await createJobHelper(market, client, evaluator);
    expect(await market.getJobsCount()).to.equal(1n);
    await createJobHelper(market, client, evaluator);
    expect(await market.getJobsCount()).to.equal(2n);
  });

  it("deploy con token address(0) revierte", async () => {
    const Market = await ethers.getContractFactory("JobMarketplace");
    await expect(Market.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      { interface: Market.interface } as any,
      "TokenInvalida"
    );
  });
});
