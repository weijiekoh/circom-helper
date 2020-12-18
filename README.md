# `circom-helper`

`circom-helper` allows developers to test circom circuits quickly and easily.

It compiles circuits and exposes a JSON-RPC API which allows developers to
generate witnesses and proofs without writing command-line glue scripts.

It is a work in progress.

Done:

- witness generation endpoint

To do:

- proof generation endpoint

## Installation

TODO: install from npm.

To build from source:

```
git clone git@github.com:weijiekoh/circom-helper.git && \
cd circom-helper && \
npm i && \
npm run build
```

TODO: add `zkutil` installation instructions

## User guide

1. Create a config file. Use `config.example.json` as a reference. The
   `circuitDirs` field should be an array of directories which contain the
   `circom` files you wish to compile. Note that there should not be any
   filename collisions, even across directories.

2. Create a `compiled/` and `temp/` directory for compiled circuits and
   tempoary files.

2. Run the server:

`node  build/index.js -c ./config.example.json -b ./compiled/ -t ./temp/ -p 9000 -nc`



### JSON-RPC API

`gen_witness`

`get_signal_index`
