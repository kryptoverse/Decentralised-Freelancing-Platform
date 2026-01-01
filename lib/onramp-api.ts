import type { FetchBuyOptions, FetchBuyQuote } from "@coinbase/cdp-react/components/Fund"

/**
 * Fetches available buy options for Onramp.
 * Forces USDC on Base network instead of ETH.
 */
export const getBuyOptions: FetchBuyOptions = async (params) => {
  try {
    const queryParams = new URLSearchParams()
    queryParams.append("country", params.country)
    if (params?.subdivision) queryParams.append("subdivision", params.subdivision)

    const queryString = queryParams.toString()
    const url = `/api/onramp/buy-options${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("getBuyOptions: API error:", errorData)
      throw new Error(errorData.error || "Failed to fetch buy options")
    }

    const result = await response.json()

    // ✅ Force USDC on Base instead of ETH
    return {
      ...result,
      cryptoCurrencies: ["usdc"],
      fiatCurrencies: ["usd"],
      networks: ["base"],
    }
  } catch (error) {
    console.error("Error fetching buy options:", error)
    throw error
  }
}

/**
 * Creates a buy quote for Onramp purchase.
 */
export const createBuyQuote: FetchBuyQuote = async (request) => {
  try {
    const response = await fetch("/api/onramp/buy-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("createBuyQuote: API error:", errorData)
      throw new Error(errorData.error || "Failed to create buy quote")
    }

    const result = await response.json()

    // ✅ Ensure the quote response is also for USDC on Base
    return {
      ...result,
      network: "base",
      cryptoCurrency: "usdc",
    }
  } catch (error) {
    console.error("Error creating buy quote:", error)
    throw error
  }
}
