import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
    Wallet,
    Send,
    Download,
    Copy,
    X,
    Loader,
    Settings,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { CONTRACT_ABI } from './contractABI';
import './index.css';

// Try to import deployment info, fallback to default values
let deploymentInfo;
try {
    deploymentInfo = require('./deploymentInfo.json');
    console.log("Loaded deployment info:", deploymentInfo);

    // Ensure totalSupply is properly formatted
    if (deploymentInfo.totalSupply && !deploymentInfo.totalSupply.startsWith('0x')) {
        // Try to convert if it's a numeric string without proper formatting
        try {
            const totalSupplyBN = ethers.getBigInt(deploymentInfo.totalSupply);
            console.log("Parsed totalSupply:", totalSupplyBN.toString());
        } catch (parseError) {
            console.warn("Could not parse totalSupply:", parseError);
            // Provide a fallback value
            deploymentInfo.totalSupply = "1000000000000000000000000"; // 1 million tokens with 18 decimals
        }
    }
} catch (error) {
    console.log('Deployment info not found, using default values');
    deploymentInfo = {
        contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Default Hardhat address
        ownerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat account
        name: "ESLSCA Coin",
        symbol: "ESLSCA",
        totalSupply: "1000000000000000000000000", // 1 million tokens with 18 decimals
        decimals: "18",
        deploymentTime: new Date().toISOString(),
        network: "localhost"
    };
}

const CONTRACT_ADDRESS = deploymentInfo.contractAddress;

function App() {
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);
    const [account, setAccount] = useState('');
    const [balance, setBalance] = useState('0');
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSendModal, setShowSendModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showMintModal, setShowMintModal] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [sendForm, setSendForm] = useState({ to: '', amount: '' });
    const [mintForm, setMintForm] = useState({ to: '', amount: '' });
    const [tokenAddedToMetaMask, setTokenAddedToMetaMask] = useState(false);

    // Function to add ESLSCA token to MetaMask
    const addTokenToMetaMask = async () => {
        try {
            if (!window.ethereum) {
                console.error('MetaMask not detected');
                return false;
            }

            const wasAdded = await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: CONTRACT_ADDRESS,
                        symbol: deploymentInfo.symbol,
                        decimals: Number(deploymentInfo.decimals),
                        name: deploymentInfo.name,
                        // You can add an image URL if you have one
                        // image: 'https://yourwebsite.com/token-image.png',
                    },
                },
            });

            if (wasAdded) {
                console.log('Token was added to MetaMask');
                setTokenAddedToMetaMask(true);
                return true;
            } else {
                console.log('User rejected adding the token');
                return false;
            }
        } catch (error) {
            console.error('Error adding token to MetaMask:', error);
            return false;
        }
    };

    // Update balance with improved error handling and fallbacks
    const updateBalance = async (contractInstance, accountAddress) => {
        try {
            console.log("Fetching balance for:", accountAddress);
            let balanceValue = null;

            // Approach 1: Standard ERC20 balanceOf
            try {
                const balance = await contractInstance.balanceOf(accountAddress);
                console.log("Balance received via standard balanceOf:", balance);
                balanceValue = balance;
            } catch (directError) {
                console.error("Direct balanceOf failed:", directError);
            }

            // Approach 2: Try getBalance (if available)
            if (!balanceValue) {
                try {
                    const balance = await contractInstance.getBalance(accountAddress);
                    console.log("Balance via getBalance:", balance);
                    balanceValue = balance;
                } catch (getBalanceError) {
                    console.error("getBalance failed:", getBalanceError);
                }
            }

            // Approach 3: Low-level call to balanceOf
            if (!balanceValue) {
                try {
                    const balanceOfSelector = "0x70a08231"; // Function selector for balanceOf(address)

                    // Ensure proper padding of the address parameter - crucial for correct encoding
                    const paddedAddress = ethers.zeroPadValue(ethers.getBytes(accountAddress), 32);
                    const data = balanceOfSelector + paddedAddress.slice(2); // Remove 0x prefix from padded address

                    let provider = contractInstance.runner;
                    // Try with provider.call
                    let result;
                    try {
                        result = await provider.call({
                            to: CONTRACT_ADDRESS,
                            data: data
                        });
                    } catch (err) {
                        // Try with provider.provider.call if available
                        if (provider.provider && typeof provider.provider.call === 'function') {
                            result = await provider.provider.call({
                                to: CONTRACT_ADDRESS,
                                data: data
                            });
                        } else {
                            throw err;
                        }
                    }

                    if (result && result !== "0x") {
                        const balance = ethers.toBigInt(result);
                        console.log("Balance via low-level call:", balance);
                        balanceValue = balance;
                    }
                } catch (lowLevelError) {
                    console.error("Low-level balance call failed:", lowLevelError);
                }
            }

            // Approach 4: Check past transfer events (more complex but can work as last fallback)
            if (!balanceValue) {
                try {
                    console.log("Attempting to calculate balance from events...");
                    // This will be handled by the loadTransactions function indirectly
                }
                catch (eventsError) {
                    console.error("Events-based balance calculation failed:", eventsError);
                }
            }

            // Last resort: Use initial supply for owner, 0 for others
            if (!balanceValue) {
                if (accountAddress.toLowerCase() === deploymentInfo.ownerAddress.toLowerCase() && deploymentInfo.totalSupply) {
                    console.log("Using initial supply from deploymentInfo");
                    balanceValue = ethers.parseEther(String(deploymentInfo.totalSupply));
                } else {
                    console.log("Setting balance to 0 as fallback");
                    balanceValue = ethers.parseEther("0");
                }
            }

            // Format and set the balance
            setBalance(ethers.formatEther(balanceValue));
        } catch (error) {
            console.error('Error updating balance:', error);
            setBalance("0");
        }
    };

    // Load transactions
    const loadTransactions = async (contractInstance, accountAddress, isAdmin) => {
        try {
            setLoading(true);
            setError('');

            // Initialize arrays for transactions
            const allTransactions = [];
            const provider = contractInstance.runner;

            // Function to safely get logs with multiple provider fallbacks
            const safeGetLogs = async (params) => {
                let logs = [];

                // Try multiple provider access patterns
                const providers = [
                    { get: () => provider.getLogs?.(params), name: 'provider.getLogs' },
                    { get: () => provider.provider?.getLogs?.(params), name: 'provider.provider.getLogs' },
                    { get: () => provider.getEvents?.(params), name: 'provider.getEvents' },
                    { get: () => provider.provider?.getEvents?.(params), name: 'provider.provider.getEvents' },
                    {
                        get: async () => {
                            const filter = contractInstance.filters.Transfer();
                            return await contractInstance.queryFilter(filter, 0, 'latest');
                        },
                        name: 'contractInstance.queryFilter'
                    }
                ];

                for (const p of providers) {
                    try {
                        console.log(`Trying ${p.name}...`);
                        logs = await p.get();
                        if (logs && logs.length >= 0) {
                            console.log(`Successfully got logs using ${p.name}`);
                            return logs;
                        }
                    } catch (err) {
                        console.warn(`${p.name} failed:`, err.message);
                    }
                }

                console.warn("All log retrieval methods failed");
                return [];
            };

            // Function to safely decode event data
            const safeDecodeEvent = (log, eventType) => {
                try {
                    if (eventType === 'transfer') {
                        // Decode TransferExecuted(address,address,uint256,uint256)
                        // Topics[0] is the event signature
                        // Topics[1] and Topics[2] are the indexed parameters (from and to)
                        const from = log.topics && log.topics[1] ?
                            ethers.getAddress('0x' + log.topics[1].slice(26)) :
                            '0x0000000000000000000000000000000000000000';

                        const to = log.topics && log.topics[2] ?
                            ethers.getAddress('0x' + log.topics[2].slice(26)) :
                            '0x0000000000000000000000000000000000000000';

                        let amount, timestamp;

                        // Try to decode the data portion
                        try {
                            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                                ['uint256', 'uint256'],
                                log.data || '0x'
                            );
                            amount = decoded[0];
                            timestamp = decoded[1];
                        } catch (decodeErr) {
                            console.warn("Error decoding transfer data:", decodeErr);
                            // Fallbacks for amount and timestamp
                            amount = log.args?.value || ethers.parseEther("0");
                            timestamp = Math.floor(Date.now() / 1000);
                        }

                        return {
                            hash: log.transactionHash || log.hash || '0x0',
                            from,
                            to,
                            amount: ethers.formatEther(amount),
                            timestamp: Number(timestamp),
                            type: from.toLowerCase() === accountAddress.toLowerCase() ? 'sent' : 'received',
                            eventType: 'transfer'
                        };
                    } else if (eventType === 'mint') {
                        // Decode TokensMinted(address,uint256,uint256)
                        const to = log.topics && log.topics[1] ?
                            ethers.getAddress('0x' + log.topics[1].slice(26)) :
                            '0x0000000000000000000000000000000000000000';

                        let amount, timestamp;

                        try {
                            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                                ['uint256', 'uint256'],
                                log.data || '0x'
                            );
                            amount = decoded[0];
                            timestamp = decoded[1];
                        } catch (decodeErr) {
                            console.warn("Error decoding mint data:", decodeErr);
                            amount = log.args?.amount || ethers.parseEther("0");
                            timestamp = Math.floor(Date.now() / 1000);
                        }

                        return {
                            hash: log.transactionHash || log.hash || '0x0',
                            from: '0x0000000000000000000000000000000000000000',
                            to,
                            amount: ethers.formatEther(amount),
                            timestamp: Number(timestamp),
                            type: 'minted',
                            eventType: 'mint'
                        };
                    }
                } catch (error) {
                    console.error(`Error decoding ${eventType} event:`, error);
                    return null;
                }
            };

            // Get transfer events
            try {
                console.log("Fetching transfer events...");
                const transferEventSignature = ethers.id("TransferExecuted(address,address,uint256,uint256)");

                const logs = await safeGetLogs({
                    address: CONTRACT_ADDRESS,
                    fromBlock: 0,
                    toBlock: 'latest',
                    topics: [transferEventSignature]
                });

                console.log(`Found ${logs.length} transfer events`);

                for (const log of logs) {
                    const decoded = safeDecodeEvent(log, 'transfer');
                    if (decoded && (isAdmin ||
                        decoded.from.toLowerCase() === accountAddress.toLowerCase() ||
                        decoded.to.toLowerCase() === accountAddress.toLowerCase())) {
                        allTransactions.push(decoded);
                    }
                }
            } catch (err) {
                console.error('Error processing transfer events:', err);
            }

            // Get mint events
            try {
                console.log("Fetching mint events...");
                const mintEventSignature = ethers.id("TokensMinted(address,uint256,uint256)");

                const mintLogs = await safeGetLogs({
                    address: CONTRACT_ADDRESS,
                    fromBlock: 0,
                    toBlock: 'latest',
                    topics: [mintEventSignature]
                });

                console.log(`Found ${mintLogs.length} mint events`);

                for (const log of mintLogs) {
                    const decoded = safeDecodeEvent(log, 'mint');
                    if (decoded && (isAdmin || decoded.to.toLowerCase() === accountAddress.toLowerCase())) {
                        allTransactions.push(decoded);
                    }
                }
            } catch (err) {
                console.error('Error processing mint events:', err);
            }

            // Fallback to standard ERC20 Transfer events if no custom events were found
            if (allTransactions.length === 0) {
                try {
                    console.log("Falling back to standard ERC20 Transfer events...");
                    const transferFilter = contractInstance.filters.Transfer();
                    const transferEvents = await contractInstance.queryFilter(transferFilter, 0, 'latest');

                    console.log(`Found ${transferEvents.length} standard transfer events`);

                    for (const event of transferEvents) {
                        try {
                            let { from, to, value } = event.args || {};

                            // Handle null or undefined values
                            from = from || '0x0000000000000000000000000000000000000000';
                            to = to || '0x0000000000000000000000000000000000000000';
                            value = value || ethers.parseEther("0");

                            // Try to get the block for timestamp
                            let timestamp;
                            try {
                                const block = await event.getBlock();
                                timestamp = block.timestamp;
                            } catch (blockErr) {
                                console.warn("Could not get block timestamp:", blockErr);
                                timestamp = Math.floor(Date.now() / 1000);
                            }

                            if (isAdmin ||
                                from.toLowerCase() === accountAddress.toLowerCase() ||
                                to.toLowerCase() === accountAddress.toLowerCase()) {
                                allTransactions.push({
                                    hash: event.transactionHash,
                                    from,
                                    to,
                                    amount: ethers.formatEther(value),
                                    timestamp,
                                    type: from.toLowerCase() === accountAddress.toLowerCase() ? 'sent' : 'received',
                                    eventType: 'transfer'
                                });
                            }
                        } catch (eventError) {
                            console.error('Error processing standard transfer event:', eventError);
                        }
                    }
                } catch (standardErr) {
                    console.error('Error with standard Transfer events:', standardErr);
                }
            }

            // Sort by timestamp (newest first)
            allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            // If still no transactions and this is the owner, add a dummy initial transaction
            if (allTransactions.length === 0 && accountAddress.toLowerCase() === deploymentInfo.ownerAddress.toLowerCase()) {
                // Create a dummy "minted" transaction for the initial supply
                const deploymentDate = new Date(deploymentInfo.deploymentTime || Date.now()).getTime() / 1000;
                const initialSupply = deploymentInfo.totalSupply || 1000000;

                allTransactions.push({
                    hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                    from: '0x0000000000000000000000000000000000000000',
                    to: deploymentInfo.ownerAddress,
                    amount: ethers.formatEther(ethers.parseEther(String(initialSupply))),
                    timestamp: deploymentDate,
                    type: 'minted',
                    eventType: 'mint'
                });
            }

            setTransactions(allTransactions);
        } catch (error) {
            console.error('Error loading transactions:', error);
            setError('Failed to load transaction history. Please try again later.');
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    // Connect to MetaMask with enhanced error handling
    const connectWallet = useCallback(async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                setLoading(true);
                setError('');

                try {
                    // Request account access
                    const accounts = await window.ethereum.request({
                        method: 'eth_requestAccounts',
                    });

                    if (!accounts || accounts.length === 0) {
                        throw new Error('No accounts returned from MetaMask');
                    }

                    // Create provider and signer
                    const provider = new ethers.BrowserProvider(window.ethereum);                    // Check if we're on the right network (Hardhat localhost with chainId 1337)
                    const network = await provider.getNetwork();
                    console.log('Connected to network:', network);

                    // Check if we're connected to the wrong network (not localhost/hardhat)
                    if (network.chainId !== 1337n && network.chainId !== 31337n) {
                        console.warn(`Connected to ${network.name} (chainId: ${network.chainId}) instead of Hardhat localhost (chainId: 1337)`);

                        try {                            // Try to switch to the Hardhat network
                            await window.ethereum.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: '0x539' }], // 1337 in hex
                            });

                            // Refresh the page after network switch
                            window.location.reload();
                            return;
                        } catch (switchError) {
                            // If the network doesn't exist in MetaMask, we need to add it
                            if (switchError.code === 4902) {
                                try {
                                    await window.ethereum.request({
                                        method: 'wallet_addEthereumChain',
                                        params: [
                                            {
                                                chainId: '0x539', // 1337 in hex
                                                chainName: 'Hardhat Local',
                                                rpcUrls: ['http://127.0.0.1:8545/'],
                                                nativeCurrency: {
                                                    name: 'ESLSCA Coin',
                                                    symbol: 'ESLSCA',
                                                    decimals: 18,
                                                },
                                            },
                                        ],
                                    });

                                    // Refresh the page after adding network
                                    window.location.reload();
                                    return;
                                } catch (addError) {
                                    throw new Error(`Could not add Hardhat network to MetaMask: ${addError.message}`);
                                }
                            } else {
                                throw new Error(`Could not switch to Hardhat network: ${switchError.message}`);
                            }
                        }
                    }

                    const signer = await provider.getSigner();
                    const account = await signer.getAddress();                    // Create contract instance with improved error handling
                    let contract;
                    try {
                        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                        // Verify contract deployment with a simple property check instead of calling name()
                        // which can fail if the contract interface is mismatched
                        if (!contract.target || contract.target.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
                            throw new Error("Contract address mismatch");
                        }

                        // Optional: Try a simple call to check if contract is responsive
                        try {
                            const symbol = await contract.symbol();
                            console.log("Contract symbol:", symbol);
                        } catch (callError) {
                            console.warn("Could not call contract symbol method, but proceeding anyway:", callError.message);
                            // Continue anyway - the contract might still work for other methods
                        }
                    } catch (contractError) {
                        console.error('Error instantiating contract:', contractError);
                        throw new Error('Failed to connect to ESLSCA Coin contract. Please make sure you are connected to the correct network (Hardhat localhost).');
                    }

                    // Set state
                    setProvider(provider);
                    setSigner(signer);
                    setContract(contract);
                    setAccount(account);

                    // Get initial balance with error handling
                    try {
                        await updateBalance(contract, account);
                    } catch (balanceError) {
                        console.error('Error fetching initial balance:', balanceError);
                        // Continue anyway - the updateBalance function has its own fallbacks
                    }

                    // Set owner status - check against deploymentInfo
                    const isAccountOwner = account.toLowerCase() === deploymentInfo.ownerAddress.toLowerCase();
                    console.log('Owner check (direct comparison):', {
                        account: account,
                        deploymentOwner: deploymentInfo.ownerAddress,
                        isOwner: isAccountOwner
                    });                    // Set isOwner state
                    setIsOwner(isAccountOwner);

                    // Try to add the token to MetaMask automatically
                    // try {
                    //     const added = await addTokenToMetaMask();
                    //     if (added) {
                    //         console.log("Token automatically added to MetaMask");
                    //     }
                    // } catch (tokenError) {
                    //     console.warn("Could not automatically add token to MetaMask:", tokenError);
                    // }

                    // Load transactions with error handling
                    try {
                        await loadTransactions(contract, account, isAccountOwner);
                    } catch (txError) {
                        console.error('Error loading initial transactions:', txError);
                        // Continue anyway - the loadTransactions function has its own fallbacks
                    }

                    setSuccess('Wallet connected successfully!');
                    setTimeout(() => setSuccess(''), 3000);
                } catch (connectionError) {
                    console.error('Error during wallet connection:', connectionError);
                    throw connectionError;
                }
            } else {
                setError('MetaMask is not installed. Please install MetaMask to use this application.');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            setError(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
            // Reset state on error
            setProvider(null);
            setSigner(null);
            setContract(null);
            setAccount('');
            setBalance('0');
            setIsOwner(false);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Send tokens with improved error handling and multiple fallbacks
    const sendTokens = async (e) => {
        e.preventDefault();
        try {
            if (!sendForm.to || !sendForm.amount) {
                setError('Please fill in all fields');
                return;
            }

            if (parseFloat(sendForm.amount) <= 0) {
                setError('Amount must be greater than 0');
                return;
            }

            if (parseFloat(sendForm.amount) > parseFloat(balance)) {
                setError('Insufficient balance');
                return;
            }

            setLoading(true);
            setError('');
            console.log(`Sending ${sendForm.amount} tokens to ${sendForm.to}`);

            // Validate the recipient address
            try {
                ethers.getAddress(sendForm.to); // Will throw if invalid address
            } catch (addressError) {
                setError('Invalid recipient address. Please check and try again.');
                setLoading(false);
                return;
            }            // Set up direct transaction parameters
            try {
                console.log('Trying standard ERC20 transfer method...');

                // First try to add the token to MetaMask if not already added
                if (!tokenAddedToMetaMask) {
                    await addTokenToMetaMask();
                }

                // Parse the amount
                const amount = ethers.parseEther(sendForm.amount);
                console.log('Amount in Wei:', amount.toString());

                // Use the contract's transfer method directly
                const tx = await contract.transfer(sendForm.to, amount);

                console.log('Transaction sent:', tx.hash);
                setSuccess('Transaction submitted! Waiting for confirmation...');

                // Wait for transaction confirmation
                const receipt = await tx.wait();
                console.log('Transaction confirmed:', receipt);
                setSuccess('Tokens sent successfully!');

                // Update state
                setSendForm({ to: '', amount: '' });
                setShowSendModal(false);

                // Update balance and transactions
                await updateBalance(contract, account);
                await loadTransactions(contract, account, isOwner);

                setTimeout(() => setSuccess(''), 5000);
                return;
            } catch (directError) {
                console.error('Error with direct contract method:', directError);

                try {
                    console.log('Falling back to manual transaction...');

                    // Parse the amount
                    const amount = ethers.parseEther(sendForm.amount);
                    console.log('Amount in Wei:', amount.toString());

                    // Create the transfer function call data manually
                    const transferSelector = "0xa9059cbb"; // Function selector for transfer(address,uint256)
                    const paddedAddress = ethers.zeroPadValue(ethers.getBytes(sendForm.to), 32);
                    const paddedAmount = ethers.zeroPadValue(ethers.toBeArray(amount), 32);

                    const data = transferSelector +
                        paddedAddress.slice(2) + // Remove 0x prefix
                        paddedAmount.slice(2);   // Remove 0x prefix

                    // Send the transaction with a moderate gas limit and price
                    const tx = await signer.sendTransaction({
                        to: CONTRACT_ADDRESS,
                        data: data,
                        gasLimit: 300000, // Higher gas limit
                        maxFeePerGas: ethers.parseUnits('50', 'gwei'), // Higher gas price
                        maxPriorityFeePerGas: ethers.parseUnits('1.5', 'gwei')
                    });

                    console.log('Transaction sent:', tx.hash);
                    setSuccess('Transaction submitted! Waiting for confirmation...');

                    // Wait for transaction confirmation
                    const receipt = await tx.wait();
                    console.log('Transaction confirmed:', receipt);
                    setSuccess('Tokens sent successfully!');

                    // Update state
                    setSendForm({ to: '', amount: '' });
                    setShowSendModal(false);

                    // Update balance and transactions
                    await updateBalance(contract, account);
                    await loadTransactions(contract, account, isOwner);

                    setTimeout(() => setSuccess(''), 5000);
                    return;
                } catch (error) {
                    console.error('Error with fallback transaction:', error);

                    // Try deploying a new contract if this is on a test network
                    if (window.confirm(`Transfer failed. This might be due to issues with the contract deployment or the local Hardhat node. Would you like to try redeploying the contract?`)) {
                        setSuccess('Please restart your Hardhat node with "npx hardhat node" and then run "npx hardhat run scripts/deploy.js --network localhost"');
                    } else {
                        setError('Transfer failed. Please try again later or contact support.');
                    }
                }
            }
        } catch (error) {
            console.error('Error sending tokens:', error);
            setError(`Failed to send tokens: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };    // Mint tokens (admin only) with improved error handling and fallbacks
    const mintTokens = async (e) => {
        e.preventDefault();
        try {
            if (!mintForm.to || !mintForm.amount) {
                setError('Please fill in all fields');
                return;
            }

            if (parseFloat(mintForm.amount) <= 0) {
                setError('Amount must be greater than 0');
                return;
            }

            // Validate the recipient address
            try {
                ethers.getAddress(mintForm.to); // Will throw if invalid address
            } catch (addressError) {
                setError('Invalid recipient address. Please check and try again.');
                return;
            } setLoading(true);
            setError('');

            console.log(`Minting ${mintForm.amount} tokens to ${mintForm.to}`);

            // First try to add the token to MetaMask if not already added
            if (!tokenAddedToMetaMask) {
                try {
                    await addTokenToMetaMask();
                } catch (tokenError) {
                    console.warn("Could not add token to MetaMask:", tokenError);
                    // Continue anyway
                }
            }

            // Try multiple mint methods in sequence
            let mintSuccess = false;

            // Method 1: Integer amount (as per contract)
            if (!mintSuccess) {
                try {
                    console.log('Trying mint with integer amount...');
                    const mintAmount = parseInt(mintForm.amount);
                    const tx = await contract.mint(mintForm.to, mintAmount);
                    setSuccess('Mint transaction submitted! Waiting for confirmation...');
                    await tx.wait();
                    setSuccess('Tokens minted successfully!');
                    mintSuccess = true;
                } catch (mintError) {
                    console.error('Error with integer mint:', mintError);
                }
            }

            // Method 2: Try with ethers.parseEther
            if (!mintSuccess) {
                try {
                    console.log('Trying mint with parseEther...');
                    const amountInWei = ethers.parseEther(mintForm.amount);
                    const tx = await contract.mint(mintForm.to, amountInWei);
                    setSuccess('Mint transaction submitted! Waiting for confirmation...');
                    await tx.wait();
                    setSuccess('Tokens minted successfully!');
                    mintSuccess = true;
                } catch (parseEtherMintError) {
                    console.error('Error with parseEther mint:', parseEtherMintError);
                }
            }

            // Method 3: Try low-level call to mint function
            if (!mintSuccess) {
                try {
                    console.log('Trying low-level mint call...');
                    // Function selector for mint(address,uint256)
                    const mintSelector = "0x40c10f19";

                    // Encode parameters
                    const paddedAddress = ethers.zeroPadValue(ethers.getBytes(mintForm.to), 32);
                    const amount = ethers.parseEther(mintForm.amount);
                    const paddedAmount = ethers.zeroPadValue(ethers.toBeArray(amount), 32);

                    // Combine selector and encoded parameters
                    const data = mintSelector +
                        paddedAddress.slice(2) + // Remove 0x prefix
                        paddedAmount.slice(2);   // Remove 0x prefix

                    const tx = await signer.sendTransaction({
                        to: CONTRACT_ADDRESS,
                        data: data
                    });

                    setSuccess('Mint transaction submitted! Waiting for confirmation...');
                    await tx.wait();
                    setSuccess('Tokens minted successfully!');
                    mintSuccess = true;
                } catch (lowLevelError) {
                    console.error('Error with low-level mint call:', lowLevelError);
                }
            }

            if (!mintSuccess) {
                throw new Error('All mint methods failed. Make sure you are the contract owner.');
            }

            setMintForm({ to: '', amount: '' });
            setShowMintModal(false);

            // Update balance and transactions
            await updateBalance(contract, account);
            await loadTransactions(contract, account, isOwner);

            setTimeout(() => setSuccess(''), 5000);
        } catch (error) {
            console.error('Error minting tokens:', error);
            setError(`Failed to mint tokens: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setSuccess('Copied to clipboard!');
            setTimeout(() => setSuccess(''), 2000);
        } catch (error) {
            setError('Failed to copy to clipboard');
        }
    };

    // Format address for display
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp * 1000).toLocaleString();
    };

    // Listen for account changes
    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected
                    setProvider(null);
                    setSigner(null);
                    setContract(null);
                    setAccount('');
                    setBalance('0');
                    setIsOwner(false);
                    setTransactions([]);
                } else {
                    // User switched accounts
                    connectWallet();
                }
            });

            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

            // Cleanup event listeners on unmount
            return () => {
                window.ethereum.removeListener('accountsChanged', () => { });
                window.ethereum.removeListener('chainChanged', () => { });
            };
        }
    }, [connectWallet]);

    // Initial connection check
    useEffect(() => {
        const checkConnection = async () => {
            if (window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) {
                        connectWallet();
                    }
                } catch (error) {
                    console.error('Error checking connection:', error);
                }
            }
        };

        checkConnection();
    }, [connectWallet]);

    if (!account) {
        return (
            <div className="app">
                <div className="container">
                    <div className="header">
                        <h1>ESLSCA Coin</h1>
                        <p>Official Cryptocurrency of ESLSCA University</p>
                        <div className="network-info">
                            Network: Localhost (Hardhat)
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="card">
                        <div className="card-content" style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <Wallet size={64} style={{ margin: '0 auto 20px', color: '#2563eb' }} />
                            <h2 style={{ marginBottom: '16px', color: '#e0e0e0' }}>Connect Your Wallet</h2>
                            <p style={{ marginBottom: '32px', color: '#6b7280' }}>
                                Connect with MetaMask to start using ESLSCA Coin
                            </p>

                            <button
                                className="connect-button"
                                onClick={connectWallet}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader className="loading-spinner" size={20} />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Wallet size={20} />
                                        Connect MetaMask
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <footer className="footer">
                    <p>&copy; 2025 ESLSCA University. All rights reserved.</p>
                    <p>Developed by Yassin Bedier, Ahmed Khattab, Ahmed Hatem, Islam Akram, Ibrahim Labib</p>
                    <p>
                        <a href="https://eslsca.edu.eg" target="_blank" rel="noopener noreferrer">
                            Visit ESLSCA University
                        </a>
                    </p>
                </footer>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="container">
                <div className="header">
                    <h1>ESLSCA Coin</h1>
                    <p>Official Cryptocurrency of ESLSCA University</p>
                    <div className="network-info">
                        Network: Localhost (Hardhat) |
                        <span className="status-badge connected" style={{ marginLeft: '8px' }}>
                            Connected
                        </span>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div style={{
                        background: '#dcfdf7',
                        color: '#047857',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <CheckCircle size={16} />
                        {success}
                    </div>
                )}

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Balance Card */}
                <div className="card">
                    <div className="card-header">
                        <h2>Your Balance</h2>
                        {isOwner && <span className="admin-badge">Admin</span>}
                    </div>
                    <div className="card-content">
                        <div className="balance-display">
                            <div className="balance-amount">{parseFloat(balance).toLocaleString()}</div>
                            <div className="balance-label">ESLSCA</div>
                        </div>                        <div className="wallet-address">
                            <strong>Wallet Address:</strong> {account}
                            <button
                                onClick={() => copyToClipboard(account)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginLeft: '8px',
                                    color: '#2563eb'
                                }}
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="actions">
                    <button
                        className="action-button"
                        onClick={() => setShowSendModal(true)}
                        disabled={loading}
                    >
                        <Send size={20} />
                        Send
                    </button>
                    <button
                        className="action-button"
                        onClick={() => setShowReceiveModal(true)}
                    >
                        <Download size={20} />
                        Receive
                    </button>
                </div>

                {/* Admin Panel */}
                {isOwner && (
                    <div className="admin-panel">
                        <button
                            className="action-button"
                            onClick={() => setShowMintModal(true)}
                            disabled={loading}
                        >
                            <Settings size={20} />
                            Mint Tokens
                        </button>
                        <button
                            className="action-button"
                            onClick={() => loadTransactions(contract, account, true)}
                            disabled={loading}
                        >
                            <X size={20} />
                            Refresh Transactions
                        </button>
                    </div>
                )}                {/* Transaction History */}
                <div className="transaction-history card">
                    <div className="card-header">
                        <h2>Transaction History</h2>
                        <button
                            onClick={() => loadTransactions(contract, account, isOwner)}
                            className="refresh-button"
                            disabled={loading}
                            title="Refresh Transactions"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                            </svg>
                        </button>
                    </div>
                    <div className="card-content">
                        {loading ? (
                            <div className="loading">
                                <Loader className="loading-spinner" size={32} />
                                <p>Loading transactions...</p>
                            </div>
                        ) : transactions.length > 0 ? (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Amount</th>
                                        <th>Date</th>
                                        <th>TX Hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, index) => (
                                        <tr key={index} className={`transaction-row ${tx.type}`}>
                                            <td className={`transaction-type ${tx.type}`}>
                                                {tx.eventType === 'transfer' ? (tx.type === 'sent' ? 'Sent' : 'Received') : 'Minted'}
                                            </td>
                                            <td>{formatAddress(tx.from)}</td>
                                            <td>{formatAddress(tx.to)}</td>
                                            <td className="transaction-amount">{parseFloat(tx.amount).toLocaleString()} ESLSCA</td>
                                            <td>{formatTimestamp(tx.timestamp)}</td>
                                            <td>
                                                <a
                                                    href={`http://localhost:8545/tx/${tx.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="transaction-hash"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        copyToClipboard(tx.hash);
                                                    }}
                                                >
                                                    {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                                    <Copy size={12} style={{ marginLeft: '4px' }} />
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-transactions">
                                <div className="empty-state">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                        <line x1="2" y1="10" x2="22" y2="10" />
                                    </svg>
                                    <p>No transactions found.</p>
                                    {isOwner && (
                                        <button
                                            className="action-button-small"
                                            onClick={() => setShowMintModal(true)}
                                        >
                                            Mint Initial Tokens
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>{/* Send Modal */}
                {showSendModal && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2>Send ESLSCA Tokens</h2>
                                    <button className="close-button" onClick={() => setShowSendModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={sendTokens}>
                                    <label>
                                        Recipient Address
                                        <input
                                            type="text"
                                            value={sendForm.to}
                                            onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                                            placeholder="0x..."
                                            required
                                        />
                                    </label>
                                    <label>
                                        Amount (ESLSCA)
                                        <input
                                            type="number"
                                            value={sendForm.amount}
                                            onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                                            placeholder="0.0"
                                            required
                                        />
                                    </label>
                                    <button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader className="loading-spinner" size={20} />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Tokens'
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Receive Modal */}
                {showReceiveModal && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2>Receive ESLSCA Tokens</h2>
                                    <button className="close-button" onClick={() => setShowReceiveModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <p>Share your wallet address with others to receive ESLSCA tokens.</p>
                                <div className="wallet-address" style={{ marginTop: '20px', fontSize: '15px' }}>
                                    {account}
                                    <button
                                        onClick={() => copyToClipboard(account)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            marginLeft: '8px',
                                            color: 'var(--primary-light)'
                                        }}
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mint Modal */}
                {showMintModal && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2>Mint New ESLSCA Tokens</h2>
                                    <button className="close-button" onClick={() => setShowMintModal(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={mintTokens}>
                                    <label>
                                        Recipient Address
                                        <input
                                            type="text"
                                            value={mintForm.to}
                                            onChange={(e) => setMintForm({ ...mintForm, to: e.target.value })}
                                            placeholder="0x..."
                                            required
                                        />
                                    </label>
                                    <label>
                                        Amount (ESLSCA)
                                        <input
                                            type="number"
                                            value={mintForm.amount}
                                            onChange={(e) => setMintForm({ ...mintForm, amount: e.target.value })}
                                            placeholder="0.0"
                                            required
                                        />
                                    </label>
                                    <button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader className="loading-spinner" size={20} />
                                                Minting...
                                            </>
                                        ) : (
                                            'Mint Tokens'
                                        )}
                                    </button>
                                </form>
                            </div>                        </div>
                    </div>
                )}
            </div>

            <footer className="footer">
                <div className="container">
                    <p>&copy; 2025 ESLSCA University. All rights reserved.</p>
                    <p>Developed by Yassin Bedier, Ahmed Khattab, Ahmed Hatem, Islam Akram, Ibrahim Labib</p>
                    <p>
                        <a href="https://eslsca.edu.eg" target="_blank" rel="noopener noreferrer">
                            Visit ESLSCA University Website
                        </a>
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default App;
