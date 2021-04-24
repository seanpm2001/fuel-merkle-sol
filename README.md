# Fuel Solidity Contracts

<!-- Disable markdownlint for long lines. -->
<!-- markdownlint-disable-file MD013 -->

![ci](https://github.com/fuellabs/fuel-v2-contracts/workflows/Node.js%20Tests%20and%20Coverage/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/fuellabs/fuel-v2-contracts/branch/master/graph/badge.svg?token=FVXeaaBA3d)](https://codecov.io/gh/fuellabs/fuel-v2-contracts)

The Fuel Solidity smart contract architecture.

## Building From Source

### Dependencies

| dep     | version                                                  |
| ------- | -------------------------------------------------------- |
| Node.js | [>=v14.0.0](https://nodejs.org/en/blog/release/v14.0.0/) |

### Building

Install dependencies:

```sh
npm ci
```

Build and run tests:

```sh
npm run build
npm test
```

## Contributing

Code must be formatted and linted.

```sh
npm run format
npm run lint
```

## License

The primary license for this repo is `Apache-2.0`, see [`LICENSE`](./LICENSE).

### Exceptions

- [`SafeCast.sol`](./contracts/utils/SafeCast.sol) is licensed under `MIT` (as indicated in the SPDX header) by [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts).
