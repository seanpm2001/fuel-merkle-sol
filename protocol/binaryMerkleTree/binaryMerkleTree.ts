/// A set of useful helper methods for testing binary Merkle trees.
import { ethers } from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { MerkleTreeObject, padBytes } from '../common';
import Node from './types/node';
import Proof from './types/proof';
import hash from '../cryptography';

export function hashLeaf(data: string): string {
	// Slice off the '0x' on each argument to simulate abi.encodePacked
	return hash('0x00'.concat(data.slice(2)));
}

export function hashNode(left: string, right: string): string {
	// Slice off the '0x' on each argument to simulate abi.encodePacked
	// hash(prefix +  left + right)
	return hash('0x01'.concat(left.slice(2)).concat(right.slice(2)));
}

// construct tree
export function constructTree(data: string[]): Node[] {
	const nodes = [];
	for (let i = 0; i < data.length; i += 1) {
		const hashed = hashLeaf(data[i]);
		const leaf = new Node(-1, -1, -1, hashed, data[i]);
		leaf.index = i;
		nodes.push(leaf);
	}

	const nodesList = [...nodes];
	let pNodes = [...nodes];

	let size = (nodes.length + 1) >> 1;
	let odd = nodes.length & 1;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		let i = 0;
		for (; i < size - odd; i += 1) {
			const j = i << 1;
			const hashed = hashNode(pNodes[j].hash, pNodes[j + 1].hash);
			nodes[i] = new Node(pNodes[j].index, pNodes[j + 1].index, -1, hashed, '');
			const nextIndex = nodesList.length;
			nodes[i].index = nextIndex;

			nodesList[pNodes[j].index].parent = nextIndex;
			nodesList[pNodes[j + 1].index].parent = nextIndex;
			nodesList.push(nodes[i]);
		}

		if (size === 1) {
			break;
		}

		if (odd === 1) {
			nodes[i] = pNodes[i << 1];
		}

		odd = size & 1;
		size = (size + 1) >> 1;
		pNodes = [...nodes];
	}
	return nodesList;
}

// compute root
export function calcRoot(data: string[]): string {
	const nodes = [];
	for (let i = 0; i < data.length; i += 1) {
		const hashed = hashLeaf(data[i]);
		nodes.push(new Node(-1, -1, -1, hashed, data[i]));
	}
	let pNodes = nodes;
	let size = (nodes.length + 1) >> 1;
	let odd = nodes.length & 1;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		let i = 0;
		for (; i < size - odd; i += 1) {
			const j = i << 1;
			const hashed = hashNode(pNodes[j].hash, pNodes[j + 1].hash);
			nodes[i] = new Node(pNodes[j].index, pNodes[j + 1].index, -1, hashed, '');
		}
		if (odd === 1) {
			nodes[i] = pNodes[i << 1];
		}
		if (size === 1) {
			break;
		}
		odd = size & 1;
		size = (size + 1) >> 1;
		pNodes = nodes;
	}
	return nodes[0].hash;
}

// get proof for the leaf
export function getProof(nodes: Node[], id: number): Proof {
	const proof = new Proof([]);
	for (let prev = id, cur = nodes[id].parent; cur !== -1; prev = cur, cur = nodes[cur].parent) {
		if (nodes[cur].left === prev) {
			proof.sideNodes.push(nodes[nodes[cur].right].hash);
		} else {
			proof.sideNodes.push(nodes[nodes[cur].left].hash);
		}
	}
	return proof;
}

// Build a tree, generate a proof for a given leaf (with optional tampering), and verify using contract
export async function checkVerify(
	bmto: MerkleTreeObject,
	numLeaves: number,
	leafNumber: number,
	tamper: boolean
): Promise<boolean> {
	const data = [];
	const keys = [];
	for (let i = 0; i < numLeaves; i += 1) {
		data.push(BN.from(i).toHexString());
		keys.push(BN.from(i).toHexString());
	}
	const leafToProve = leafNumber - 1;
	const nodes = constructTree(data);
	const root = nodes[nodes.length - 1];
	let dataToProve = data[leafToProve];
	const proof = getProof(nodes, leafToProve);

	if (tamper) {
		// Introduce bad data:
		const badData = ethers.utils.formatBytes32String('badData');
		dataToProve = badData;
	}

	const result = await bmto.mock.verify(
		root.hash,
		dataToProve,
		proof,
		padBytes(keys[leafToProve]),
		keys.length
	);

	return result;
}

export async function checkAppend(
	bmto: MerkleTreeObject,
	numLeaves: number,
	badProof: boolean
): Promise<boolean> {
	const data = [];
	const size = numLeaves;
	for (let i = 0; i < size; i += 1) {
		data.push(BN.from(i).toHexString());
	}

	const leafToAppend = BN.from(42).toHexString();
	data.push(leafToAppend);
	const nodes = constructTree(data);

	const proof = getProof(nodes, numLeaves);

	if (badProof) {
		proof.sideNodes.push(ethers.constants.HashZero);
	}

	const result = await bmto.mock.append(numLeaves, leafToAppend, proof);
	const root = result[0];

	return root === calcRoot(data);
}

export async function checkAddBranch(
	bmto: MerkleTreeObject,
	numLeaves: number,
	leafNumber: number
): Promise<boolean> {
	// First build a tree
	const data = [];
	const keys = [];
	const size = numLeaves;
	let nodes: Node[] = [];

	// Build a tree offline
	for (let i = 0; i < size; i += 1) {
		data.push(BN.from(i).toHexString());
		keys.push(BN.from(i).toHexString());
	}

	// Create a proof for a given leaf
	const leafToProve = leafNumber - 1;
	const key = keys[leafToProve];
	const leaf = data[leafToProve];
	nodes = constructTree(data);
	const proof = getProof(nodes, leafToProve);

	// Add branch to tree
	await bmto.mock.addBranch(padBytes(key), leaf, proof, size);

	// Compare roots
	const root = nodes[nodes.length - 1].hash;
	const storageRoot = await bmto.mock.getRoot();

	return storageRoot === root;
}

export async function checkUpdate(
	bmto: MerkleTreeObject,
	numLeaves: number,
	leavesToAdd: number[],
	leavesToUpdate: number[]
): Promise<boolean> {
	// First build a full tree in ts
	const leaves = [];
	const keys = [];

	for (let i = 0; i < numLeaves; i += 1) {
		const leaf = BN.from(i).toHexString();
		const key = BN.from(i).toHexString();

		leaves.push(leaf);
		keys.push(key);
	}
	let nodes = constructTree(leaves);

	// Add some branches to the storage tree
	let proof;
	let leafNum;

	for (let j = 0; j < leavesToAdd.length; j += 1) {
		leafNum = leavesToAdd[j] - 1;
		proof = getProof(nodes, leafNum);
		await bmto.mock.addBranch(padBytes(keys[leafNum]), leaves[leafNum], proof, numLeaves);
	}

	// Update a couple of the leaves on the storage tree
	const d = 1337;
	const data = BN.from(d).toHexString();

	for (let k = 0; k < leavesToUpdate.length; k += 1) {
		const updateKey = leavesToUpdate[k] - 1;
		await bmto.mock.update(padBytes(keys[updateKey]), data);
		leaves[updateKey] = data;
	}

	// Build the entire tree with the updated leaves in ts from scratch
	nodes = constructTree(leaves);

	// Compare roots
	const root = nodes[nodes.length - 1].hash;
	const storageRoot = await bmto.mock.getRoot();

	return storageRoot === root;
}
