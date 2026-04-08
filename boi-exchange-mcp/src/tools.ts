/**
 * Tool registrations for boi-exchange-mcp.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getLatestRate,
  getHistoricalRates,
  listAvailableCurrencies,
} from "./client.js";

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerTools(server: McpServer): void {
  // --- get_exchange_rate ---
  server.registerTool(
    "get_exchange_rate",
    {
      title: "Get Exchange Rate",
      description:
        "Get the latest official representative exchange rate (sha'ar yatzig) published by the Bank of Israel for a currency against the Israeli New Shekel (ILS). Returns the most recent rate available, typically from the last business day.",
      inputSchema: {
        currency: z
          .string()
          .min(3)
          .max(3)
          .describe(
            "ISO 4217 currency code, e.g. USD, EUR, GBP, JPY, CHF, CAD, AUD"
          ),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency }) => {
      try {
        const entry = await getLatestRate(currency);
        const output = {
          currency: currency.toUpperCase(),
          rate: entry.rate,
          date: entry.date,
          unit: `1 ${currency.toUpperCase()} = ${entry.rate} ILS`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- get_historical_rates ---
  server.registerTool(
    "get_historical_rates",
    {
      title: "Get Historical Rates",
      description:
        "Get official Bank of Israel representative exchange rates for a currency against ILS over a date range. Returns daily rates for each business day in the range. The BOI publishes rates Sunday through Thursday.",
      inputSchema: {
        currency: z
          .string()
          .min(3)
          .max(3)
          .describe("ISO 4217 currency code, e.g. USD, EUR, GBP"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
          .describe("Start date in YYYY-MM-DD format"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
          .describe("End date in YYYY-MM-DD format"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency, startDate, endDate }) => {
      if (startDate > endDate) {
        return { content: [{ type: "text" as const, text: "Error: startDate must be before or equal to endDate" }] };
      }
      try {
        const entries = await getHistoricalRates(currency, startDate, endDate);
        const output = {
          currency: currency.toUpperCase(),
          startDate,
          endDate,
          count: entries.length,
          rates: entries.map((e) => ({ date: e.date, rate: e.rate })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- list_currencies ---
  server.registerTool(
    "list_currencies",
    {
      title: "List Currencies",
      description:
        "List all currency codes for which the Bank of Israel publishes representative exchange rates against the Israeli New Shekel (ILS). Returns ISO 4217 codes.",
      inputSchema: {},
      annotations: TOOL_ANNOTATIONS,
    },
    async () => {
      try {
        const currencies = await listAvailableCurrencies();
        const output = {
          count: currencies.length,
          currencies,
          note: "All rates are quoted as 1 unit of foreign currency = X ILS",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- get_rate_change ---
  server.registerTool(
    "get_rate_change",
    {
      title: "Get Rate Change",
      description:
        "Calculate the change in the Bank of Israel representative exchange rate for a currency against ILS between two dates. Returns the absolute change and percentage change.",
      inputSchema: {
        currency: z
          .string()
          .min(3)
          .max(3)
          .describe("ISO 4217 currency code, e.g. USD, EUR, GBP"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
          .describe("Start date in YYYY-MM-DD format"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
          .describe("End date in YYYY-MM-DD format"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency, startDate, endDate }) => {
      if (startDate > endDate) {
        return { content: [{ type: "text" as const, text: "Error: startDate must be before or equal to endDate" }] };
      }
      try {
        const entries = await getHistoricalRates(currency, startDate, endDate);
        const first = entries[0];
        const last = entries[entries.length - 1];
        const absoluteChange = last.rate - first.rate;
        const percentChange = (absoluteChange / first.rate) * 100;

        const direction =
          absoluteChange > 0
            ? "weakened"
            : absoluteChange < 0
              ? "strengthened"
              : "unchanged";

        const output = {
          currency: currency.toUpperCase(),
          startDate: first.date,
          startRate: first.rate,
          endDate: last.date,
          endRate: last.rate,
          absoluteChange: Math.round(absoluteChange * 10000) / 10000,
          percentChange: Math.round(percentChange * 100) / 100,
          direction: `ILS ${direction} against ${currency.toUpperCase()}`,
          dataPoints: entries.length,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- convert_currency ---
  server.registerTool(
    "convert_currency",
    {
      title: "Convert Currency",
      description:
        "Convert an amount between ILS and another currency using the latest official Bank of Israel representative rate. One of fromCurrency or toCurrency must be ILS.",
      inputSchema: {
        amount: z
          .number()
          .positive()
          .describe("Amount to convert"),
        fromCurrency: z
          .string()
          .min(3)
          .max(3)
          .describe("Source currency code, e.g. USD, ILS"),
        toCurrency: z
          .string()
          .min(3)
          .max(3)
          .describe("Target currency code, e.g. ILS, EUR"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ amount, fromCurrency, toCurrency }) => {
      try {
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();

        if (from !== "ILS" && to !== "ILS") {
          return errorResult(
            "One of fromCurrency or toCurrency must be ILS. The Bank of Israel publishes rates against the shekel only."
          );
        }

        if (from === "ILS" && to === "ILS") {
          return errorResult(
            "fromCurrency and toCurrency cannot both be ILS."
          );
        }

        const foreignCurrency = from === "ILS" ? to : from;
        const entry = await getLatestRate(foreignCurrency);

        let result: number;
        if (from === "ILS") {
          result = amount / entry.rate;
        } else {
          result = amount * entry.rate;
        }

        const output = {
          from: { currency: from, amount },
          to: {
            currency: to,
            amount: Math.round(result * 100) / 100,
          },
          rate: entry.rate,
          rateDate: entry.date,
          rateDescription: `1 ${foreignCurrency} = ${entry.rate} ILS`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}
