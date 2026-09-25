/**
 * lib/shopify/client.ts
 *
 * The one place in the app that talks to Shopify directly (spec §8 —
 * "the rest of the application must not directly depend on raw Shopify API
 * calls"). services/shopify/* call this client; nothing outside
 * lib/shopify + services/shopify should import it.
 *
 * Uses the GraphQL Admin API, not REST: Shopify marked the REST Admin API
 * legacy as of Oct 1 2024 and requires GraphQL for any app built after
 * Apr 1 2025 (https://shopify.dev/docs/api/usage/versioning). The exact
 * SHOPIFY_API_VERSION is an env var — bump it each time Shopify ships a
 * new stable release (verify at https://shopify.dev/docs/api/admin-graphql).
 */

import type { ShopifyOrderNode, ShopifyProductNode, PageInfo } from "./types";

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly graphQLErrors?: unknown
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export class ShopifyClient {
  constructor(
    private readonly shopDomain: string,
    private readonly accessToken: string,
    private readonly apiVersion: string
  ) {}

  private endpoint() {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;
  }

  /** Low-level GraphQL call with one retry on Shopify's THROTTLED cost error. */
  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(this.endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ShopifyApiError(`Shopify GraphQL HTTP ${res.status}`, res.status, text);
      }

      const json = await res.json();

      if (json.errors) {
        const throttled = json.errors.some(
          (e: { extensions?: { code?: string } }) => e.extensions?.code === "THROTTLED"
        );
        if (throttled && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw new ShopifyApiError("Shopify GraphQL error", undefined, json.errors);
      }

      return json.data as T;
    }
    throw new ShopifyApiError("Shopify GraphQL throttled after retry");
  }

  async fetchShop(): Promise<{ id: string; myshopifyDomain: string; name: string }> {
    const data = await this.graphql<{ shop: { id: string; myshopifyDomain: string; name: string } }>(
      `query { shop { id myshopifyDomain name } }`
    );
    return data.shop;
  }

  async fetchProductsPage(
    first: number,
    after: string | null
  ): Promise<{ nodes: ShopifyProductNode[]; pageInfo: PageInfo }> {
    const data = await this.graphql<{
      products: { edges: { node: ShopifyProductNode }[]; pageInfo: PageInfo };
    }>(
      `query Products($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              handle
              status
              updatedAt
              variants(first: 100) {
                edges { node { id title sku price } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { first, after }
    );
    return {
      nodes: data.products.edges.map((e) => e.node),
      pageInfo: data.products.pageInfo,
    };
  }

  async fetchOrdersPage(
    first: number,
    after: string | null
  ): Promise<{ nodes: ShopifyOrderNode[]; pageInfo: PageInfo }> {
    const data = await this.graphql<{
      orders: { edges: { node: ShopifyOrderNode }[]; pageInfo: PageInfo };
    }>(
      `query Orders($first: Int!, $after: String) {
        orders(first: $first, after: $after, sortKey: PROCESSED_AT) {
          edges {
            node {
              id
              name
              displayFinancialStatus
              displayFulfillmentStatus
              currencyCode
              subtotalPriceSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              totalDiscountsSet { shopMoney { amount } }
              totalPriceSet { shopMoney { amount } }
              totalRefundedSet { shopMoney { amount } }
              processedAt
              createdAt
              updatedAt
              customer { id }
              lineItems(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    quantity
                    variant { id }
                    originalUnitPriceSet { shopMoney { amount } }
                    totalDiscountSet { shopMoney { amount } }
                  }
                }
              }
              refunds {
                id
                createdAt
                note
                totalRefundedSet { shopMoney { amount } }
                refundLineItems(first: 50) {
                  edges { node { lineItem { id } quantity restockType } }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { first, after }
    );
    return {
      nodes: data.orders.edges.map((e) => e.node),
      pageInfo: data.orders.pageInfo,
    };
  }

  /** Fetches a single order by its GraphQL gid — used by the order webhooks. */
  async fetchOrderById(gid: string): Promise<ShopifyOrderNode | null> {
    const data = await this.graphql<{ order: ShopifyOrderNode | null }>(
      `query OrderById($id: ID!) {
        order(id: $id) {
          id
          name
          displayFinancialStatus
          displayFulfillmentStatus
          currencyCode
          subtotalPriceSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          processedAt
          createdAt
          updatedAt
          customer { id }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                sku
                quantity
                variant { id }
                originalUnitPriceSet { shopMoney { amount } }
                totalDiscountSet { shopMoney { amount } }
              }
            }
          }
          refunds {
            id
            createdAt
            note
            totalRefundedSet { shopMoney { amount } }
            refundLineItems(first: 50) {
              edges { node { lineItem { id } quantity restockType } }
            }
          }
        }
      }`,
      { id: gid }
    );
    return data.order;
  }

  async fetchProductById(gid: string): Promise<ShopifyProductNode | null> {
    const data = await this.graphql<{ product: ShopifyProductNode | null }>(
      `query ProductById($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          status
          updatedAt
          variants(first: 100) {
            edges { node { id title sku price } }
          }
        }
      }`,
      { id: gid }
    );
    return data.product;
  }

  /** Registers one webhook subscription. Idempotent-ish: Shopify rejects exact duplicates per topic+address, which we treat as success. */
  async registerWebhook(topic: string, callbackUrl: string): Promise<void> {
    const data = await this.graphql<{
      webhookSubscriptionCreate: {
        userErrors: { field: string[]; message: string }[];
      };
    }>(
      `mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      {
        topic,
        webhookSubscription: { callbackUrl, format: "JSON" },
      }
    );

    const errors = data.webhookSubscriptionCreate.userErrors;
    const alreadyExists = errors.some((e) => /already exists|taken/i.test(e.message));
    if (errors.length && !alreadyExists) {
      throw new ShopifyApiError(
        `Failed to register webhook ${topic}: ${errors.map((e) => e.message).join("; ")}`
      );
    }
  }
}
