const { createPublicClient, http, decodeEventLog } = require('viem');
const { polygonAmoy } = require('viem/chains');

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http()
});

const ENTRYPOINT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "paymaster", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "success", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "actualGasCost", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "actualGasUsed", "type": "uint256" }
    ],
    "name": "UserOperationEvent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "indexed": false, "internalType": "bytes", "name": "revertReason", "type": "bytes" }
    ],
    "name": "UserOperationRevertReason",
    "type": "event"
  }
];

async function main() {
  const hash = '0xe7fcf3489dc7a3ae203cc376928f92f698cb2eec8ea8198b72e6b1b7e795e292';
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ENTRYPOINT_ABI,
          data: log.data,
          topics: log.topics
        });
        if (decoded.eventName === 'UserOperationEvent') {
            console.log("UserOp Success:", decoded.args.success);
            console.log("actualGasUsed:", decoded.args.actualGasUsed.toString());
        }
        if (decoded.eventName === 'UserOperationRevertReason') {
            const hex = decoded.args.revertReason;
            console.log("Revert Reason Hex:", hex);
            // Decode Error(string) if any
            if (hex.startsWith('0x08c379a0')) {
                const str = client.decodeErrorResult({
                  abi: [{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"Error","type":"error"}],
                  data: hex
                });
                console.log("Decoded String:", str);
            }
        }
      } catch (e) {
        // Not an entrypoint event we care about
      }
    }
  } catch (e) {
    console.error(e);
  }
}
main();
