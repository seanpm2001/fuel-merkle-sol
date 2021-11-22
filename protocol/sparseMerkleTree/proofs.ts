import { leafDigest, nodeDigest, parseLeaf } from './treeHasher';
import hash from '../cryptography';
import { getBitAtFromMSB, ZERO } from './utils';
import SparseMerkleProof from './types/sparseMerkleProof';
import SparseCompactMerkleProof from './types/sparseCompactMerkleProof';

export function verifyProof(
	proof: SparseMerkleProof,
	root: string,
	key: string,
	value: string
): [boolean, string[][]] {
	const updates: string[][] = [[]];

	// Detemine what the leaf hash should be
	let currentHash;
	let currentData;
	let actualPath;
	let valueHash;

	if (value === ZERO) {
		// Non-membership proof
		if (proof.NonMembershipLeafData === '') {
			currentHash = ZERO;
		} else {
			// leaf is an unrelated leaf
			[actualPath, valueHash] = parseLeaf(proof.NonMembershipLeafData);
			if (actualPath === key) {
				// Leaf does exist : non-membership proof failed
				return [false, []];
			}
			[currentHash, currentData] = leafDigest(actualPath, valueHash);
			updates.push([currentHash, currentData]);
		}
	} else {
		// Membership proof
		valueHash = hash(value);
		updates.push([valueHash, value]);

		[currentHash, currentData] = leafDigest(key, value);
		updates.push([currentHash, currentData]);
	}

	// Recompute root
	for (let i = 0; i < proof.SideNodes.length; i += 1) {
		const node = proof.SideNodes[i];

		if (getBitAtFromMSB(key, proof.SideNodes.length - 1 - i) === 1) {
			[currentHash, currentData] = nodeDigest(node, currentHash);
		} else {
			[currentHash, currentData] = nodeDigest(currentHash, node);
		}

		updates.push([currentHash, currentData]);
	}

	return [currentHash === root, updates];
}

export function compactProof(proof: SparseMerkleProof): SparseCompactMerkleProof {
	const bitMask: number[] = [];
	const compactedSideNodes: string[] = [];
	let node;

	for (let i = 0; i < proof.SideNodes.length; i += 1) {
		node = proof.SideNodes[i];
		if (node === ZERO) {
			bitMask.push(0);
		} else {
			compactedSideNodes.push(node);
			bitMask.push(1);
		}
	}
	const compactedProof = new SparseCompactMerkleProof(
		compactedSideNodes,
		proof.NonMembershipLeafData,
		bitMask,
		proof.SideNodes.length,
		proof.SiblingData
	);
	return compactedProof;
}

export function decompactProof(proof: SparseCompactMerkleProof): SparseMerkleProof {
	const decompactedSideNodes: string[] = [];
	let position = 0;

	for (let i = 0; i < proof.NumSideNodes; i += 1) {
		if (proof.BitMask[i] === 0) {
			decompactedSideNodes[i] = ZERO;
		} else {
			decompactedSideNodes[i] = proof.SideNodes[position];
			position += 1;
		}
	}
	const decompactedProof = new SparseMerkleProof(
		decompactedSideNodes,
		proof.NonMembershipLeafData,
		proof.SiblingData
	);

	return decompactedProof;
}
