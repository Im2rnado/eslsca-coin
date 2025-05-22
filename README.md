# ESLSCA Coin

ESLSCA Coin is a blockchain-based cryptocurrency created for ESLSCA University, implemented as an ERC-20 token on the Ethereum blockchain.

## Project Overview

This project includes:
- A Solidity smart contract for the ESLSCA Coin token
- A React-based frontend application for interacting with the token
- Comprehensive testing and deployment scripts

## Features

- ERC-20 compliant token with 18 decimals
- Initial supply of 1,000,000 ESLSCA tokens
- Admin-only minting functionality
- Transfer capabilities between addresses
- Transaction history tracking
- MetaMask integration for wallet connectivity

## Technology Stack

- **Smart Contract**: Solidity, OpenZeppelin
- **Blockchain Development**: Hardhat, Ethers.js
- **Frontend**: React.js
- **UI Components**: Lucide React
- **Testing**: Mocha, Chai

## Project Structure

```
/
├── contracts/                 # Smart contracts
│   └── ESLSCACoin.sol         # Main ERC-20 token contract
├── frontend/                  # React frontend application
│   ├── public/                # Static files
│   └── src/                   # React components and assets
├── scripts/                   # Deployment scripts
│   └── deploy.js              # Main deployment script
├── test/                      # Test files
│   └── ESLSCACoin.test.js     # Contract tests
├── hardhat.config.js          # Hardhat configuration
└── package.json               # Project dependencies
```

## Prerequisites

- Node.js (v14.x or later)
- npm or yarn
- MetaMask browser extension

## Installation

1. Clone the repository
2. Install dependencies for the main project:
   ```
   npm install
   ```
3. Install dependencies for the frontend:
   ```
   cd frontend
   npm install
   cd ..
   ```

## Deployment and Testing

### Local Development

1. Start a local Hardhat node:
   ```
   npm run node
   ```

2. In a new terminal, deploy the contract to the local network:
   ```
   npm run deploy
   ```
   This will:
   - Deploy the ESLSCA Coin contract to the local network
   - Initialize it with 1,000,000 tokens
   - Save deployment information to the frontend

3. Start the frontend application:
   ```
   npm run dev
   ```

4. Configure MetaMask to connect to the local Hardhat network:
   - Network Name: Localhost
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ESLSCA

5. Import one of the Hardhat accounts into MetaMask using the private key that was printed in the console when you started the node.

### Running Tests

Run the comprehensive test suite with:
```
npm test
```

This will execute all tests in the `test` directory, verifying:
- Token deployment
- Transfer functionality
- Minting capabilities
- Events emission
- Access control (owner-only functions)

## Usage Guide

### As a Regular User

1. Connect your MetaMask wallet to the application
2. View your token balance
3. Send tokens to another address
4. View your transaction history

### As the Admin (Contract Owner)

1. Connect with the owner wallet
2. Access the admin panel
3. Mint new tokens to any address
4. Monitor all transactions on the network

## Troubleshooting

- **MetaMask Connection Issues**: Ensure you've configured MetaMask correctly with the Hardhat network settings
- **Transaction Failures**: Check that you have enough ETH in your account for gas
- **Frontend Not Showing Contract Data**: Verify that the deployment information was properly saved to `frontend/src/deploymentInfo.json`

## Contributors

- Yassin Bedier
- Ahmed Khattab
- Ahmed Hatem
- Islam Akram
- Ibrahim Labib

## License

This project is licensed under the MIT License.

## Acknowledgements

- OpenZeppelin for secure contract libraries
- Hardhat for the development environment
- ESLSCA University for the project opportunity
