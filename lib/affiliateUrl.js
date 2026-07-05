export function buildAffiliateUrl({
  loja,
  asin,
  ml_id,
  amazon_affiliate_url,
  ml_affiliate_url,
  tagAmazon,
  tagML,
}) {
  if (loja === "amazon") {
    if (amazon_affiliate_url) return amazon_affiliate_url;
    if (!asin || !tagAmazon) throw new Error("Amazon exige asin e tagAmazon");
    const a = encodeURIComponent(asin);
    const t = encodeURIComponent(tagAmazon);
    return `https://www.amazon.com.br/dp/${a}?tag=${t}`;
  }

  if (loja === "ml") {
    if (ml_affiliate_url) return ml_affiliate_url;
    if (!ml_id || !tagML) throw new Error("ML exige ml_id e tagML");
    const id = encodeURIComponent(ml_id);
    const t = encodeURIComponent(tagML);
    return `https://produto.mercadolivre.com.br/${id}?mf_id=${t}`;
  }

  throw new Error(`Loja desconhecida: ${loja}`);
}
