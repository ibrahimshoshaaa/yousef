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

const ORDER_CONTACT_FIELDS = `
  shippingAddress { name phone address1 address2 city province country zip }
  billingAddress { name phone address1 address2 city province country zip }
`;

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

  async fetchFulfillmentState(id: string) {
    const data = await this.graphql<{ order: null | {
      displayFulfillmentStatus: string;
      fulfillmentOrders: { nodes: { id: string; status: string }[]; pageInfo: { hasNextPage: boolean } };
      fulfillments: { id: string; status: string; displayStatus: string; deliveredAt: string | null }[];
    } }>(`query FulfillmentState($id: ID!) {
      order(id: $id) {
        displayFulfillmentStatus
        fulfillmentOrders(first: 100) { nodes { id status } pageInfo { hasNextPage } }
        fulfillments(first: 100) { id status displayStatus deliveredAt }
      }
    }`, { id });
    return data.order;
  }

  async createFulfillment(fulfillmentOrderId: string) {
    const data = await this.graphql<{ fulfillmentCreate: {
      fulfillment: { id: string } | null;
      userErrors: { message: string }[];
    } }>(`mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id }
        userErrors { message }
      }
    }`, { fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId }], notifyCustomer: false } });
    const result = data.fulfillmentCreate;
    if (result.userErrors.length || !result.fulfillment) throw new ShopifyApiError(result.userErrors.map(e => e.message).join("; ") || "تعذر إنشاء شحنة Shopify");
    return result.fulfillment;
  }

  async createDeliveryEvent(fulfillmentId: string) {
    const data = await this.graphql<{ fulfillmentEventCreate: {
      fulfillmentEvent: { id: string } | null;
      userErrors: { message: string }[];
    } }>(`mutation MarkDelivered($fulfillmentEvent: FulfillmentEventInput!) {
      fulfillmentEventCreate(fulfillmentEvent: $fulfillmentEvent) {
        fulfillmentEvent { id }
        userErrors { message }
      }
    }`, { fulfillmentEvent: { fulfillmentId, status: "DELIVERED" } });
    const result = data.fulfillmentEventCreate;
    if (result.userErrors.length || !result.fulfillmentEvent) throw new ShopifyApiError(result.userErrors.map(e => e.message).join("; ") || "تعذر تسجيل التسليم في Shopify");
    return result.fulfillmentEvent;
  }

  /** Contact access depends on the app's protected customer data permissions. */
  private async orderQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    try {
      return await this.graphql<T>(query, variables);
    } catch (error) {
      if (!(error instanceof ShopifyApiError) || !/access denied|protected customer data/i.test(error.message)) {
        throw error;
      }
      return this.graphql<T>(query.replace(ORDER_CONTACT_FIELDS, ""), variables);
    }
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
        const details = json.errors
          .map((error: { message?: string }) => error.message)
          .filter((message: unknown): message is string => typeof message === "string")
          .join("; ");
        throw new ShopifyApiError(
          details ? `Shopify GraphQL error: ${details}` : "Shopify GraphQL error",
          undefined,
          json.errors
        );
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
    const data = await this.orderQuery<{
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
              ${ORDER_CONTACT_FIELDS}
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
    const data = await this.orderQuery<{ order: ShopifyOrderNode | null }>(
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
          ${ORDER_CONTACT_FIELDS}
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

  /** The deterministic handle makes retrying a timed-out publish safe. */
  async publishSingleVariantProduct(input: { handle: string; title: string; price: string }): Promise<string> {
    const data = await this.graphql<{
      productSet: { product: { id: string } | null; userErrors: { message: string }[] };
    }>(
      `mutation PublishErpProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
        productSet(input: $input, identifier: $identifier, synchronous: true) {
          product { id }
          userErrors { message }
        }
      }`,
      {
        identifier: { handle: input.handle },
        input: {
          title: input.title,
          handle: input.handle,
          status: "ACTIVE",
          productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
          variants: [{ price: input.price, optionValues: [{ optionName: "Title", name: "Default Title" }] }],
        },
      }
    );
    if (data.productSet.userErrors.length || !data.productSet.product) {
      throw new ShopifyApiError(data.productSet.userErrors.map(error => error.message).join("; ") || "تعذر نشر المنتج في Shopify");
    }
    return data.productSet.product.id;
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
