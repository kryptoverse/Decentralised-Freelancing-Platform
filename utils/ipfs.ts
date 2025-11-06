export function ipfsToHttp(uri: string) {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;

  const cid = uri.replace("ipfs://", "");
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || "ipfs.io";

  return `https://${gateway}/ipfs/${cid}`;
}
