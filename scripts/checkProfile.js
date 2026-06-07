const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("https://rpc-amoy.polygon.technology/", 80002);
    const factoryAbi = ["function freelancerProfile(address) view returns (address)"];
    
    // Read the factory address from deployedContracts.json
    const deployedContracts = JSON.parse(fs.readFileSync("constants/deployedContracts.json", "utf8"));
    const factoryAddress = deployedContracts.addresses.FreelancerFactory;
    
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    
    const walletsToCheck = [
        "0xDEd8e5C08fD108c6eDE834e0BFF25904E03c5094", // platformWallet
        "0xDE9aabc1421BA15ed9aCD975D11668272e26aaf5", // resolver
        // Add more if known
    ];
    
    for (const wallet of walletsToCheck) {
        try {
            const profileAddr = await factory.freelancerProfile(wallet);
            console.log(`Wallet ${wallet} -> Profile: ${profileAddr}`);
        } catch(e) {
            console.log(`Error checking wallet ${wallet}: ${e.message}`);
        }
    }
}
main();
