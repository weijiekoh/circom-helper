# `circom-helper`

`circom-helper` allows developers to test circom circuits quickly and easily.

It compiles circuits and exposes a JSON-RPC API which allows developers to
generate witnesses and access signal values without writing command-line glue
scripts.

Done:

- witness generation endpoint
- signal index lookup endpoint

## Installation

`npm i circom-helper`

To build from source:

```
git clone git@github.com:weijiekoh/circom-helper.git && \
cd circom-helper && \
npm i && \
npm run build
```

### Install OS dependencies

On Debian, Ubuntu, or derivatives:

```
sudo apt-get install libgmp-dev nlohmann-json3-dev nasm g++
```

On openSUSE or derivatives:

```
sudo zypper install gmp-devel nlohmann_json-devel nasm g++
```

## User guide

1. Create a config file. Use `config.example.json` as a reference. The
   `circuitDirs` field should be an array of directories which contain the
   `circom` files you wish to compile. Note that there should not be any
   filename collisions, even across directories. Additionally, ensure
   that you install `circom`, `snarkjs`, `circom_runtime`, and `ffiasm`
   in your project's `node_modules`, and check their paths in the config
   file.

2. Create a `compiled/` and `temp/` directory for compiled circuits and
   tempoary files.

2. Run the server:

`node  build/index.js -c ./config.example.json -b ./compiled/ -p 9000 -nc`

### JSON-RPC API

**`gen_witness`**

Generates a witness given a circuit name and public inputs.

Inputs: 

- `circuit`: the name of the circuit. For example, if `test.circom` is in one
  of the `circuitDirs`, and you want to generate a witness for inputs to this
  circuit, set this value as `test`.
- `inputs`: the public inputs to the circuit (as a JS object). For example: `{
  left: '1', right: '2' }`. The number values should be strings as the JS safe
  integer limit is lower than the group order for BN254 and other elliptic
  curves used for ZK proofs.

Returns:

- `witness`: an array of strings (e.g. `[1, 3, 1, 2]`).

To find the index of any signal (e.g. `main.out`), use `get_signal_index`. With
this index, you can then look up this array and get the value of the signal.

**`get_signal_index`**

Inputs:

- `circuit`: the name of the circuit.
- `name`: the signal name (e.g. `main.out`).

Returns:

- `index`: a numeric value as a string.
