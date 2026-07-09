const urls = [
  "https://link.amazon/B0hvOVGAl",
  "https://link.amazon/B0c1RPmDH",
  "https://link.amazon/B0gbQ3uVu",
  "https://link.amazon/B0gfDJRhc",
  "https://link.amazon/B0bgB5pVm",
  "https://link.amazon/B05rzHiXU",
  "https://link.amazon/B0gyHdgRp",
  "https://link.amazon/B08a0O0yc",
  "https://link.amazon/B06XYZICK",
  "https://link.amazon/B07rVgfb4",
  "https://link.amazon/B0iUCEGZI",
  "https://link.amazon/B07x28jqj",
]

for (const url of urls) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    })
    const html = await res.text()
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "N/A"
    const canonical =
      html.match(/rel="canonical"[^>]*href="([^"]+)"/)?.[1] ?? "N/A"
    const price = html.match(/a-price-whole[^>]*>([^<]+)</)?.[1] ?? "N/A"
    const imgMatch =
      html.match(/<img[^>]+data-old-hires="([^"]+)"/)?.[1] ||
      html.match(/<img[^>]+src="([^"]+\._AC_[^"]+)"/)?.[1] ||
      "N/A"
    console.log(`${url}`)
    console.log(`  Final: ${res.url}`)
    console.log(`  Title: ${title}`)
    console.log(`  Canonical: ${canonical}`)
    console.log(`  Price: ${price}`)
    console.log(`  Image: ${imgMatch}`)
    console.log("---")
  } catch (e) {
    console.log(`${url} -> ERROR: ${e.message}`)
    console.log("---")
  }
}
