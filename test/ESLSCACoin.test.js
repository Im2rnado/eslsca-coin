const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ESLSCACoin", function () {
    let ESLSCACoin;
    let eslscaCoin;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        // Get the ContractFactory and Signers here
        ESLSCACoin = await ethers.getContractFactory("ESLSCACoin");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();        // Deploy the contract
        eslscaCoin = await ESLSCACoin.deploy(
            "ESLSCA Coin",
            "ESLSCA",
            ethers.parseEther("1000000"), // 1 million initial supply
            owner.address
        );
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await eslscaCoin.owner()).to.equal(owner.address);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await eslscaCoin.balanceOf(owner.address);
            expect(await eslscaCoin.totalSupply()).to.equal(ownerBalance);
        });

        it("Should set the correct name and symbol", async function () {
            expect(await eslscaCoin.name()).to.equal("ESLSCA Coin");
            expect(await eslscaCoin.symbol()).to.equal("ESLSCA");
        });

        it("Should set 18 decimals", async function () {
            expect(await eslscaCoin.decimals()).to.equal(18);
        });
    });

    describe("Transactions", function () {
        it("Should transfer tokens between accounts", async function () {
            // Transfer 50 tokens from owner to addr1
            await eslscaCoin.transfer(addr1.address, ethers.parseEther("50"));
            const addr1Balance = await eslscaCoin.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(ethers.parseEther("50"));

            // Transfer 50 tokens from addr1 to addr2
            await eslscaCoin.connect(addr1).transfer(addr2.address, ethers.parseEther("25"));
            const addr2Balance = await eslscaCoin.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(ethers.parseEther("25"));
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const initialOwnerBalance = await eslscaCoin.balanceOf(owner.address);

            // Try to send 1 token from addr1 (0 tokens) to owner (1000000 tokens)
            await expect(
                eslscaCoin.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(eslscaCoin, "ERC20InsufficientBalance");

            // Owner balance shouldn't have changed
            expect(await eslscaCoin.balanceOf(owner.address)).to.equal(initialOwnerBalance);
        });

        it("Should update balances after transfers", async function () {
            const initialOwnerBalance = await eslscaCoin.balanceOf(owner.address);

            // Transfer 100 tokens from owner to addr1 and addr2
            await eslscaCoin.transfer(addr1.address, ethers.parseEther("100"));
            await eslscaCoin.transfer(addr2.address, ethers.parseEther("50"));

            // Check balances
            const finalOwnerBalance = await eslscaCoin.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance - ethers.parseEther("150"));

            const addr1Balance = await eslscaCoin.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(ethers.parseEther("100"));

            const addr2Balance = await eslscaCoin.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(ethers.parseEther("50"));
        });
    });

    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const initialSupply = await eslscaCoin.totalSupply();            // Owner mints 1000 tokens to addr1
            await eslscaCoin.mint(addr1.address, ethers.parseEther("1000"));

            const finalSupply = await eslscaCoin.totalSupply();
            const addr1Balance = await eslscaCoin.balanceOf(addr1.address);

            expect(finalSupply).to.equal(initialSupply + ethers.parseEther("1000"));
            expect(addr1Balance).to.equal(ethers.parseEther("1000"));
        });

        it("Should not allow non-owner to mint tokens", async function () {
            await expect(
                eslscaCoin.connect(addr1).mint(addr2.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(eslscaCoin, "OwnableUnauthorizedAccount");
        });

        it("Should not allow minting to zero address", async function () {
            await expect(
                eslscaCoin.mint(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("Cannot mint to zero address");
        }); it("Should not allow minting zero amount", async function () {
            await expect(
                eslscaCoin.mint(addr1.address, ethers.parseEther("0"))
            ).to.be.revertedWith("Amount must be greater than 0");
        });
    }); describe("Events", function () {
        it("Should emit TokensMinted event when minting", async function () {
            const tx = await eslscaCoin.mint(addr1.address, ethers.parseEther("1000"));
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);

            await expect(tx)
                .to.emit(eslscaCoin, "TokensMinted")
                .withArgs(addr1.address, ethers.parseEther("1000"), block.timestamp);
        });

        it("Should emit TransferExecuted event when transferring", async function () {
            const tx = await eslscaCoin.transfer(addr1.address, ethers.parseEther("100"));
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);

            await expect(tx)
                .to.emit(eslscaCoin, "TransferExecuted")
                .withArgs(owner.address, addr1.address, ethers.parseEther("100"), block.timestamp);
        });
    });

    describe("Contract Info", function () {
        it("Should return correct contract information", async function () {
            const [name, symbol, totalSupply, decimals, contractOwner] = await eslscaCoin.getContractInfo();

            expect(name).to.equal("ESLSCA Coin");
            expect(symbol).to.equal("ESLSCA");
            expect(totalSupply).to.equal(ethers.parseEther("1000000"));
            expect(decimals).to.equal(18);
            expect(contractOwner).to.equal(owner.address);
        });

        it("Should return correct balance for getBalance function", async function () {
            const balance = await eslscaCoin.getBalance(owner.address);
            expect(balance).to.equal(ethers.parseEther("1000000"));
        });
    });
});

// Helper function for time
const time = {
    latest: async () => {
        const block = await ethers.provider.getBlock('latest');
        return block.timestamp;
    }
};