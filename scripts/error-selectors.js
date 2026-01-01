const { keccak256, toUtf8Bytes } = require("ethers/lib/utils");

const errors = [
  "ZeroAddress()",
  "NotClient()",
  "NotFreelancer()",
  "NotResolver()",
  "NotFactory()",
  "AlreadyDelivered()",
  "NotDelivered()",
  "AlreadyTerminal()",
  "CancelWindowOver()",
  "CancelNotRequested()",
  "InvalidCaller()",
  "AmountZero()",
  "NoDispute()",
  "Disputed()",
  "TooEarly()",
  "BpsTooHigh()",
];

for (const err of errors) {
  console.log(err, keccak256(toUtf8Bytes(err)).slice(0, 10));
}

