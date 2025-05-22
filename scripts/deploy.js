const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const ESLSCACoin = await ethers.getContractFactory("ESLSCACoin");

    // Deploy with 1,000,000 tokens (with 18 decimals)
    const initialSupply = ethers.parseEther("1000000"); // This gives us 1,000,000 * 10^18

    const eslscaCoin = await ESLSCACoin.deploy(
        "ESLSCA Coin",
        "ESLSCA",
        initialSupply,
        deployer.address
    );

    await eslscaCoin.waitForDeployment();

    console.log("ESLSCACoin deployed to:", await eslscaCoin.getAddress());
    console.log("Total supply:", ethers.formatEther(await eslscaCoin.totalSupply()), "ESLSCA");

    // Save deployment info
    const deploymentInfo = {
        contractAddress: await eslscaCoin.getAddress(),
        ownerAddress: deployer.address,
        name: "ESLSCA Coin",
        symbol: "ESLSCA",
        totalSupply: (await eslscaCoin.totalSupply()).toString(),
        decimals: "18",
        deploymentTime: new Date().toISOString(),
        network: "localhost"
    };

    // Write to file
    const fs = require('fs');
    fs.writeFileSync(
        './frontend/src/deploymentInfo.json',
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("Deployment info saved to frontend/src/deploymentInfo.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });