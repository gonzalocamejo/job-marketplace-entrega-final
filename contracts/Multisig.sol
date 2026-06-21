// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract Multisig {

    struct Transaccion {
        address owner;
        address destino;
        uint256 valor;
        bytes callData;
        address[] firmasRecibidas;
        bool ejecutada;
        bool eliminada;
    }

    address[] private ApprovedSigners;
    uint256 private threshold;
    Transaccion[] private transaccionesPendientes;

    error TransaccionFallida();
    error FirmasInsuficientes();
    error SignerNoAprobado();
    error YaSeFirmo();
    error NoSosElOwner();
    error PropuestaNoActiva();
    error ThresholdInvalido();
    error ListaDeSignersInvalida();
    error SignerDuplicado();
    error IndiceFueraDeRango();

    event PropuestaCreada(
        uint256 indexed id,
        address indexed owner,
        address indexed destino,
        uint256 valor,
        bytes callData
    );
    event PropuestaAprobada(
        uint256 indexed id,
        address indexed signer,
        uint256 aprobacionesActuales
    );
    event PropuestaEjecutada(uint256 indexed id, address indexed ejecutor);
    event PropuestaCancelada(uint256 indexed id, address indexed owner);

    constructor(address[] memory addresses, uint256 value) {
        if (addresses.length == 0) revert ListaDeSignersInvalida();
        if (value == 0 || value > addresses.length) revert ThresholdInvalido();

        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == address(0)) revert ListaDeSignersInvalida();
            for (uint256 j = i + 1; j < addresses.length; j++) {
                if (addresses[i] == addresses[j]) revert SignerDuplicado();
            }
            ApprovedSigners.push(addresses[i]);
        }

        threshold = value;
    }

    function Propuesta(address destino, bytes calldata data)
        external
        payable
        isApprovedSigner
    {
        uint256 id = transaccionesPendientes.length;

        transaccionesPendientes.push();
        Transaccion storage trs = transaccionesPendientes[id];
        trs.owner = msg.sender;
        trs.destino = destino;
        trs.valor = msg.value;
        trs.callData = data;
        trs.ejecutada = false;
        trs.eliminada = false;

        emit PropuestaCreada(id, msg.sender, destino, msg.value, data);
    }

    function Aprobacion(uint256 transaccionPos)
        external
        existePropuesta(transaccionPos)
        isApprovedSigner
        hasNotSigned(transaccionPos)
        NoEjecutadaNiEliminada(transaccionPos)
    {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        trs.firmasRecibidas.push(msg.sender);

        emit PropuestaAprobada(transaccionPos, msg.sender, trs.firmasRecibidas.length);
    }

    function Ejecucion(uint256 transaccionPos)
        external
        existePropuesta(transaccionPos)
        isApprovedSigner
        NoEjecutadaNiEliminada(transaccionPos)
    {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        if (trs.firmasRecibidas.length < threshold) revert FirmasInsuficientes();

        trs.ejecutada = true;

        (bool success, ) = payable(trs.destino).call{value: trs.valor}(trs.callData);
        if (!success) revert TransaccionFallida();

        emit PropuestaEjecutada(transaccionPos, msg.sender);
    }

    function Cancelacion(uint256 transaccionPos)
        external
        existePropuesta(transaccionPos)
        isTransactionOwner(transaccionPos)
        NoEjecutadaNiEliminada(transaccionPos)
    {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        trs.eliminada = true;

        if (trs.valor > 0) {
            (bool success, ) = payable(trs.owner).call{value: trs.valor}("");
            if (!success) revert TransaccionFallida();
        }

        emit PropuestaCancelada(transaccionPos, trs.owner);
    }

    function getTransacciones() external view returns (Transaccion[] memory) {
        return transaccionesPendientes;
    }

    function getTransaccion(uint256 id)
        external
        view
        existePropuesta(id)
        returns (Transaccion memory)
    {
        return transaccionesPendientes[id];
    }

    function getTransaccionesCount() external view returns (uint256) {
        return transaccionesPendientes.length;
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function getTreshold() external view returns (uint256) {
        return threshold;
    }

    function getSigners() external view returns (address[] memory) {
        return ApprovedSigners;
    }

    function esSigner(address cuenta) external view returns (bool) {
        return _esSigner(cuenta);
    }

    function yaFirmo(uint256 transaccionPos, address signer)
        external
        view
        existePropuesta(transaccionPos)
        returns (bool)
    {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        for (uint256 i = 0; i < trs.firmasRecibidas.length; i++) {
            if (trs.firmasRecibidas[i] == signer) return true;
        }
        return false;
    }

    function _esSigner(address cuenta) internal view returns (bool) {
        for (uint256 i = 0; i < ApprovedSigners.length; i++) {
            if (ApprovedSigners[i] == cuenta) return true;
        }
        return false;
    }


    modifier isApprovedSigner() {
        if (!_esSigner(msg.sender)) revert SignerNoAprobado();
        _;
    }

    modifier hasNotSigned(uint256 transaccionPos) {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        for (uint256 i = 0; i < trs.firmasRecibidas.length; i++) {
            if (trs.firmasRecibidas[i] == msg.sender) revert YaSeFirmo();
        }
        _;
    }

    modifier isTransactionOwner(uint256 transaccionPos) {
        if (transaccionesPendientes[transaccionPos].owner != msg.sender) {
            revert NoSosElOwner();
        }
        _;
    }

    modifier NoEjecutadaNiEliminada(uint256 transaccionPos) {
        Transaccion storage trs = transaccionesPendientes[transaccionPos];
        if (trs.ejecutada || trs.eliminada) revert PropuestaNoActiva();
        _;
    }

    modifier existePropuesta(uint256 transaccionPos) {
        if (transaccionPos >= transaccionesPendientes.length) revert IndiceFueraDeRango();
        _;
    }
}
