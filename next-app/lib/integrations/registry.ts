export type IntegrationCategory="commerce"|"social"|"advertising"|"storage";

export interface OAuthExchangeResult{accessToken:string;refreshToken?:string;accountLabel:string;raw:unknown}

export interface IntegrationAdapter{
  id:string;
  label:string;
  category:IntegrationCategory;
  configured:boolean;
  buildAuthUrl(redirectUri:string,state:string):string;
  exchangeCode(code:string,redirectUri:string):Promise<OAuthExchangeResult>;
}

/**
 * Shopify uses per-store OAuth: the shop domain is part of the auth URL, so
 * we require it up front (passed as `shop` in the connect request) rather
 * than discovering it from the callback.
 */
class ShopifyAdapter implements IntegrationAdapter{
  id="shopify";label="Shopify";category="commerce" as const;
  get configured(){return Boolean(process.env.SHOPIFY_CLIENT_ID&&process.env.SHOPIFY_CLIENT_SECRET)}
  buildAuthUrl(redirectUri:string,state:string,shop?:string):string{
    if(!shop)throw new Error("Shopify requires a shop domain (e.g. your-store.myshopify.com)");
    const qs=new URLSearchParams({
      client_id:process.env.SHOPIFY_CLIENT_ID!,
      scope:"read_products,read_orders",
      redirect_uri:redirectUri,
      state
    });
    return `https://${shop}/admin/oauth/authorize?${qs.toString()}`;
  }
  async exchangeCode(code:string,redirectUri:string,shop?:string):Promise<OAuthExchangeResult>{
    if(!shop)throw new Error("Missing shop domain for token exchange");
    const res=await fetch(`https://${shop}/admin/oauth/access_token`,{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID,client_secret:process.env.SHOPIFY_CLIENT_SECRET,code})
    });
    const raw=await res.json();
    if(!res.ok)throw new Error(raw?.error_description||"Shopify token exchange failed");
    void redirectUri;
    return {accessToken:raw.access_token,accountLabel:shop,raw};
  }
}

class MetaAdapter implements IntegrationAdapter{
  id="meta";label="Meta (Facebook & Instagram)";category="social" as const;
  get configured(){return Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET)}
  buildAuthUrl(redirectUri:string,state:string):string{
    const qs=new URLSearchParams({
      client_id:process.env.META_APP_ID!,
      redirect_uri:redirectUri,
      scope:"pages_show_list,instagram_basic,ads_management",
      state
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${qs.toString()}`;
  }
  async exchangeCode(code:string,redirectUri:string):Promise<OAuthExchangeResult>{
    const qs=new URLSearchParams({
      client_id:process.env.META_APP_ID!,client_secret:process.env.META_APP_SECRET!,
      redirect_uri:redirectUri,code
    });
    const res=await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${qs.toString()}`);
    const raw=await res.json();
    if(!res.ok)throw new Error(raw?.error?.message||"Meta token exchange failed");
    return {accessToken:raw.access_token,accountLabel:"Meta Business account",raw};
  }
}

/**
 * Providers not yet given a concrete adapter — same connect/disconnect
 * state machine applies once one is written (follow ShopifyAdapter or
 * MetaAdapter as the template), but for now `configured` is always false
 * so the UI shows an honest "not connected" state rather than a fake button.
 */
class UnimplementedAdapter implements IntegrationAdapter{
  configured=false;
  constructor(public id:string,public label:string,public category:IntegrationCategory){}
  buildAuthUrl():string{throw new Error(`${this.label} isn't connected yet`)}
  async exchangeCode():Promise<OAuthExchangeResult>{throw new Error(`${this.label} isn't connected yet`)}
}

export const INTEGRATIONS:IntegrationAdapter[]=[
  new ShopifyAdapter(),
  new UnimplementedAdapter("woocommerce","WooCommerce","commerce"),
  new MetaAdapter(),
  new UnimplementedAdapter("tiktok","TikTok","social"),
  new UnimplementedAdapter("youtube","YouTube","social"),
  new UnimplementedAdapter("google_ads","Google Ads","advertising"),
  new UnimplementedAdapter("cloud_storage","Cloud Storage","storage")
];

export function getIntegration(id:string){return INTEGRATIONS.find(i=>i.id===id)}
