const { ethers } = require("ethers");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("https://rpc-amoy.polygon.technology/", 80002);
    const txHash = "0x331b1e73146d0b4e9c4bd587c3d0560b67e692c024206f7d42e19d154e7bcdb1";
    
    console.log("Fetching tx:", txHash);
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
        console.log("Tx not found");
        return;
    }
    
    console.log("Tx found!");
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.log("No receipt yet");
        return;
    }
    
    console.log("Status:", receipt.status);
    if (receipt.status === 0) {
        console.log("Tx reverted!");
        try {
            const code = await provider.call(tx, tx.blockNumber);
            console.log("Revert reason:", ethers.utils.toUtf8String("0x" + code.slice(138)));
        } catch (e) {
            console.log("Could not decode revert reason via call:", e.message);
        }
    } else {
        console.log("Tx succeeded on-chain. Maybe UserOp reverted internally?");
        // Look for UserOperationEvent logs to see if it reverted internally
        for (const log of receipt.logs) {
            if (log.topics[0] === "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f") {
                console.log("UserOperationEvent found:");
                const decoded = ethers.utils.defaultAbiCoder.decode(["uint256", "bool", "uint256", "uint256"], log.data);
                console.log("Success:", decoded[1]);
                if (!decoded[1]) {
                    console.log("UserOp reverted! Wait, looking for RevertReason...");
                }
            } else if (log.topics[0] === "0x1c412eb609eb403b9b46efaf7df78351543bb92b77c6cb3f98e826b52a42cd9a") {
                console.log("UserOperationRevertReason found:");
                try {
                    const decodedData = ethers.utils.defaultAbiCoder.decode(["uint256", "uint256", "bytes"], log.data);
                    const revertReasonHex = decodedData[2];
                    if (revertReasonHex !== "0x") {
                         console.log("Hex reason:", revertReasonHex);
                         if (revertReasonHex.startsWith("0x08c379a0")) { // Error(string)
                             const reasonString = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + revertReasonHex.slice(10))[0];
                             console.log("String Reason:", reasonString);
                         } else {
                             // Try to find custom error matching ProfileExists() = 0x82b4a1b0
                             console.log("Raw revert bytes:", revertReasonHex);
                         }
                    }
                } catch(e) {
                    console.log("Could not decode:", log.data);
                }
            }
        }
    }
}
main();
