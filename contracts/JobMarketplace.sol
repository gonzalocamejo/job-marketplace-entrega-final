// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title JobMarketplace — Mercado de trabajos freelance con escrow ERC-20
/// @notice Inspirado en ERC-8183 (Agentic Commerce Protocol). Un token ERC-20 fijo
///         actúa como moneda de pago; los fondos quedan en escrow hasta que el
///         evaluador aprueba o rechaza el trabajo.
contract JobMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errores ──────────────────────────────────────────────────────────────
    error SeRequiereCliente();
    error SeRequiereEvaluador();
    error SeRequiereProvider();
    error RolInvalido();
    error TrabajoYaTieneProvedor();
    error EstadoInvalido();
    error ParaRechazarSeDebeSerClienteOEvaluador();
    error ParaReclamarDebeEstarExpirado();
    error TokenInvalida();
    error JobInexistente();

    // ── Eventos ───────────────────────────────────────────────────────────────
    /// @notice Emitido al crear un trabajo. Contiene todos los campos necesarios
    ///         para que el frontend liste trabajos leyendo solo este evento.
    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address evaluator,
        address provider,
        uint256 budget,
        string  description,
        uint256 expiresAt
    );
    event ProviderAssigned(uint256 indexed jobId, address indexed provider);
    event JobFunded(uint256 indexed jobId);
    event JobSubmitted(uint256 indexed jobId, bytes32 deliverableRef);
    event JobCompleted(uint256 indexed jobId, bytes32 reason);
    /// @notice Emitido cuando el cliente rechaza en estado Open (sin fondos).
    event JobRejected(uint256 indexed jobId, bytes32 reason);
    /// @notice Emitido cuando el evaluador rechaza en Funded/Submitted (con reembolso).
    event JobRefunded(uint256 indexed jobId, bytes32 reason);
    event JobExpired(uint256 indexed jobId);

    // ── Tipos ─────────────────────────────────────────────────────────────────
    enum Rol { Client, Evaluator, Provider }

    enum JobState {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,   // rechazado por el client en Open
        Refunded,   // rechazado por el evaluador en Funded/Submitted (fondos devueltos)
        Expired     // reclamado por cualquiera luego de expiresAt
    }

    struct Job {
        address client;
        address evaluator;
        address provider;
        uint256 budget;
        uint256 expiresAt;
        string  description;
        JobState state;
        bytes32 deliverableRef;
        bytes32 resolutionReason;
    }

    // ── Estado ────────────────────────────────────────────────────────────────
    IERC20 public immutable token;
    Job[] private jobList;

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _token) {
        if (_token == address(0)) revert TokenInvalida();
        token = IERC20(_token);
    }

    // ── Funciones públicas ────────────────────────────────────────────────────

    /// @notice Crea un nuevo trabajo en estado Open.
    /// @param description Descripción del trabajo.
    /// @param budget      Cantidad de tokens ERC-20 que se bloqueará en escrow.
    /// @param evaluator   Dirección del evaluador (obligatorio).
    /// @param provider    Dirección del proveedor (opcional, address(0) si aún no se conoce).
    /// @param expiresAt   Timestamp Unix en segundos a partir del cual se puede reclamar reembolso.
    function createJob(
        string  calldata description,
        uint256 budget,
        address evaluator,
        address provider,
        uint256 expiresAt
    ) external {
        if (evaluator == address(0)) revert SeRequiereEvaluador();

        uint256 jobId = jobList.length;
        jobList.push(Job({
            client:           msg.sender,
            evaluator:        evaluator,
            provider:         provider,
            budget:           budget,
            expiresAt:        expiresAt,
            description:      description,
            state:            JobState.Open,
            deliverableRef:   bytes32(0),
            resolutionReason: bytes32(0)
        }));

        emit JobCreated(jobId, msg.sender, evaluator, provider, budget, description, expiresAt);
    }

    /// @notice Asigna un proveedor a un trabajo Open que aún no tiene proveedor.
    /// @param jobId    Identificador del trabajo.
    /// @param provider Dirección del proveedor a asignar.
    function setProvider(uint256 jobId, address provider)
        external
        requiresRol(jobId, msg.sender, Rol.Client)
        requiresStatus(jobId, JobState.Open)
    {
        if (jobList[jobId].provider != address(0)) revert TrabajoYaTieneProvedor();
        jobList[jobId].provider = provider;
        emit ProviderAssigned(jobId, provider);
    }

    /// @notice El cliente fondea el escrow transfiriendo `budget` tokens al contrato.
    ///         Requiere approve previo del cliente al contrato por al menos `budget` tokens.
    /// @param jobId Identificador del trabajo.
    function fund(uint256 jobId)
        external
        nonReentrant
        requiresStatus(jobId, JobState.Open)
        requiresRol(jobId, msg.sender, Rol.Client)
    {
        jobList[jobId].state = JobState.Funded;
        token.safeTransferFrom(msg.sender, address(this), jobList[jobId].budget);
        emit JobFunded(jobId);
    }

    /// @notice El proveedor entrega la referencia al entregable (bytes32 hash/CID).
    /// @param jobId          Identificador del trabajo.
    /// @param deliverableRef Referencia al entregable (hash, CID de IPFS, etc.).
    function submit(uint256 jobId, bytes32 deliverableRef)
        external
        requiresStatus(jobId, JobState.Funded)
        requiresRol(jobId, msg.sender, Rol.Provider)
    {
        jobList[jobId].deliverableRef = deliverableRef;
        jobList[jobId].state = JobState.Submitted;
        emit JobSubmitted(jobId, deliverableRef);
    }

    /// @notice El evaluador aprueba el trabajo y libera los fondos al proveedor.
    /// @param jobId  Identificador del trabajo.
    /// @param reason Razón de la aprobación (bytes32 opcional).
    function complete(uint256 jobId, bytes32 reason)
        external
        nonReentrant
        requiresStatus(jobId, JobState.Submitted)
        requiresRol(jobId, msg.sender, Rol.Evaluator)
    {
        Job storage theJob = jobList[jobId];
        theJob.resolutionReason = reason;
        theJob.state = JobState.Completed;
        token.safeTransfer(theJob.provider, theJob.budget);
        emit JobCompleted(jobId, reason);
    }

    /// @notice Rechaza el trabajo. El cliente puede rechazar en Open; el evaluador
    ///         puede rechazar en Funded o Submitted (reembolsa al cliente).
    /// @param jobId  Identificador del trabajo.
    /// @param reason Razón del rechazo (bytes32 opcional).
    function reject(uint256 jobId, bytes32 reason) external nonReentrant {
        if (_esCliente(jobId, msg.sender)) {
            _rejectCliente(jobId, reason);
        } else if (_esEvaluador(jobId, msg.sender)) {
            _rejectEvaluador(jobId, reason);
        } else {
            revert ParaRechazarSeDebeSerClienteOEvaluador();
        }
    }

    /// @notice Cualquiera puede reclamar el reembolso si el trabajo expiró y
    ///         aún hay fondos en escrow (estado Funded o Submitted).
    /// @param jobId Identificador del trabajo.
    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage theJob = jobList[jobId];
        if (block.timestamp <= theJob.expiresAt) revert ParaReclamarDebeEstarExpirado();
        if (theJob.state != JobState.Funded && theJob.state != JobState.Submitted)
            revert EstadoInvalido();

        // CEI: estado antes de la transferencia
        address clientAddr = theJob.client;
        uint256 budgetAmt  = theJob.budget;
        theJob.state = JobState.Expired;
        token.safeTransfer(clientAddr, budgetAmt);
        emit JobExpired(jobId);
    }

    // ── Vistas ────────────────────────────────────────────────────────────────

    /// @notice Devuelve la cantidad total de trabajos creados.
    function getJobsCount() external view returns (uint256) {
        return jobList.length;
    }

    /// @notice Devuelve el struct completo de un trabajo.
    /// @param jobId Identificador del trabajo.
    function getJob(uint256 jobId) external view returns (Job memory) {
        if (jobId >= jobList.length) revert JobInexistente();
        return jobList[jobId];
    }

    // ── Internos ──────────────────────────────────────────────────────────────

    function _rejectCliente(uint256 jobId, bytes32 reason)
        internal
        requiresStatus(jobId, JobState.Open)
    {
        Job storage theJob = jobList[jobId];
        theJob.state = JobState.Rejected;
        theJob.resolutionReason = reason;
        emit JobRejected(jobId, reason);
    }

    function _rejectEvaluador(uint256 jobId, bytes32 reason) internal {
        if (jobList[jobId].state != JobState.Funded && jobList[jobId].state != JobState.Submitted)
            revert EstadoInvalido();

        Job storage theJob = jobList[jobId];
        address clientAddr = theJob.client;
        uint256 budgetAmt  = theJob.budget;
        theJob.state = JobState.Refunded;
        theJob.resolutionReason = reason;
        token.safeTransfer(clientAddr, budgetAmt);
        emit JobRefunded(jobId, reason);
    }

    function _esCliente(uint256 jobId, address cli) internal view returns (bool) {
        return jobList[jobId].client == cli;
    }

    function _esEvaluador(uint256 jobId, address eva) internal view returns (bool) {
        return jobList[jobId].evaluator == eva;
    }

    function _esProvider(uint256 jobId, address pro) internal view returns (bool) {
        return jobList[jobId].provider == pro;
    }

    // ── Modificadores ─────────────────────────────────────────────────────────

    modifier requiresRol(uint256 jobId, address caller, Rol rol) {
        if (rol == Rol.Client) {
            if (!_esCliente(jobId, caller)) revert SeRequiereCliente();
        } else if (rol == Rol.Evaluator) {
            if (!_esEvaluador(jobId, caller)) revert SeRequiereEvaluador();
        } else if (rol == Rol.Provider) {
            if (!_esProvider(jobId, caller)) revert SeRequiereProvider();
        } else {
            revert RolInvalido();
        }
        _;
    }

    modifier requiresStatus(uint256 jobId, JobState state) {
        if (jobList[jobId].state != state) revert EstadoInvalido();
        _;
    }
}
