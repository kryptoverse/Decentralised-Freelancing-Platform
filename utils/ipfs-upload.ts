export async function uploadToIPFS(data: any): Promise<string> {
    try {
        const response = await fetch("/api/files", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: data,
                name: `direct_offer_${Date.now()}.json`
            }),
        });

        if (!response.ok) {
            throw new Error("Upload failed");
        }

        const { cid } = await response.json();
        return `ipfs://${cid}`;
    } catch (error) {
        console.error("Error uploading to Pinata via API:", error);
        throw error;
    }
}
