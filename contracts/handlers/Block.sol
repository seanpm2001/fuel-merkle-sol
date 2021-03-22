// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../types/BlockCommitment.sol";
import "../types/BlockHeader.sol";
import "../lib/Block.sol";
import "../lib/Transaction.sol";

/// @title The Fuel block handler logic.
library BlockHandler {
    ///////////////
    // Constants //
    ///////////////

    // Maximum number of transactions in list of transactions.
    uint32 public constant MAX_TRANSACTIONS_IN_BLOCK = 2048;

    // Maximum number of digests registered in a block (2 bytes).
    uint32 public constant MAX_BLOCK_DIGESTS = 0xFFFF;

    ////////////
    // Events //
    ////////////

    event BlockCommitted(
        bytes32 indexed previousBlockHash,
        uint32 indexed height,
        address indexed producer,
        BlockHeader block
    );

    /////////////
    // Methods //
    /////////////

    /// @notice Commits a new rollup block.
    function commitBlock(mapping(bytes32 => BlockCommitment) storage s_BlockCommitments, BlockHeader memory blockHeader)
        internal
    {
        // Calldata max size enforcement (~2M gas / 16 gas per byte/32kb payload target).
        require(blockHeader.transactionLength <= MAX_TRANSACTIONS_IN_BLOCK, "transactions-size-overflow");

        // Calldata max size enforcement (~2M gas / 16 gas per byte/32kb payload target).
        require(blockHeader.digestLength < uint256(MAX_BLOCK_DIGESTS), "digest-length-overflow");

        // Check caller is not a contract.
        uint256 callerCodeSize;
        address producer = blockHeader.producer;
        assembly {
            callerCodeSize := extcodesize(producer)
        }
        require(callerCodeSize == 0, "is-contract");

        // Block hash.
        bytes32 blockHash = BlockLib.computeBlockId(blockHeader);

        // Store block commitment.
        s_BlockCommitments[blockHeader.previousBlockHash].children.push(blockHash);

        // Emit the block committed event.
        emit BlockCommitted(blockHeader.previousBlockHash, blockHeader.height, blockHeader.producer, blockHeader);
    }
}
