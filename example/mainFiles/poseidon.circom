include "../../node_modules/circomlib/circuits/poseidon.circom";

template Hasher() {
    signal input left;
    signal input right;
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    out <== hasher.out;
}

component main = Hasher();
