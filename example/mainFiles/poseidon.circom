include "../../node_modules/circomlib/circuits/poseidon.circom";

template Hasher() {
    signal input in[2];
    signal input expectedHash;
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== in[0];
    hasher.inputs[1] <== in[1];

    expectedHash === hasher.out;

    out <== hasher.out;
}

component main = Hasher();
