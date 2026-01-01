import type { FetchBuyQuote, OnrampBuyQuoteSnakeCaseResponse } from "@coinbase/cdp-react"
import { type NextRequest, NextResponse } from "next/server"

import { generateCDPJWT, getCDPCredentials, ONRAMP_API_BASE_URL } from "@/lib/cdp-auth"
import { convertSnakeToCamelCase } from "@/lib/to-camel-case"

type OnrampBuyQuoteResponseRaw = OnrampBuyQuoteSnakeCaseResponse
type OnrampBuyQuoteResponse = Awaited<ReturnType<FetchBuyQuote>>

/**
 * Creates a buy quote for onramp purchase
 *
 * @param request - NextRequest object containing the quote request
 * @returns NextResponse object with the quote details
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CDP credentials are configured
    try {
      getCDPCredentials()
    } catch (_error) {
      return NextResponse.json({ error: "CDP API credentials not configured" }, { status: 500 })
    }

    const body = await request.json()

    const apiPath = "/onramp/v1/buy/quote"

    // Generate JWT for CDP API authentication
    const jwt = await generateCDPJWT({
      requestMethod: "POST",
      requestHost: new URL(ONRAMP_API_BASE_URL).hostname,
      requestPath: apiPath,
    })

    // Call CDP API to create buy quote
    const response = await fetch(`${ONRAMP_API_BASE_URL}${apiPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error("CDP API error:", response.statusText)
      const errorText = await response.text()
      console.error("Error details:", errorText)

      try {
        const errorData = JSON.parse(errorText)
        return NextResponse.json(
          { error: errorData.message || "Failed to create buy quote" },
          { status: response.status },
        )
      } catch {
        return NextResponse.json({ error: "Failed to create buy quote" }, { status: response.status })
      }
    }

    const data: OnrampBuyQuoteResponseRaw = await response.json()
    const dataCamelCase: OnrampBuyQuoteResponse = convertSnakeToCamelCase(data)
    return NextResponse.json(dataCamelCase)
  } catch (error) {
    console.error("Error creating buy quote:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
