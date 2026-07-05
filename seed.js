import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUTOS = [
  {
    slug: "mouse-gamer-logitech-g203",
    nome: "Mouse Gamer Logitech G203",
    descricao: "Mouse gamer 8000 DPI, 6 botoes programaveis, RGB LIGHTSYNC. Perfeito para FPS e MOBA.",
    asin: "B08L2TC2JL",
    ml_id: "MLB12345678",
    loja_prioritaria: "amazon",
    categoria: "Perifericos",
    preco: 149.90,
    imagem_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80",
  },
  {
    slug: "teclado-mecanico-redragon",
    nome: "Teclado Mecanico Redragon Kumara",
    descricao: "Switch Outemu Blue, retroiluminacao RGB, teclas anti-ghosting. Som mecanico classico.",
    asin: "B07JZQ7WGP",
    ml_id: "MLB23456789",
    loja_prioritaria: "amazon",
    categoria: "Perifericos",
    preco: 219.90,
    imagem_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80",
  },
  {
    slug: "monitor-gamer-24-acer",
    nome: "Monitor Gamer Acer 24 144Hz",
    descricao: "Tela 23.8 Full HD, 144Hz, 1ms, FreeSync. Entrada HDMI 2.0 e DisplayPort.",
    asin: "B09X6QHJ7P",
    ml_id: "MLB34567890",
    loja_prioritaria: "ml",
    categoria: "Monitores",
    preco: 1299.00,
    imagem_url: "https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?w=600&q=80",
  },
  {
    slug: "headset-hyperx-cloud-2",
    nome: "Headset HyperX Cloud II",
    descricao: "Som surround virtual 7.1, microfone anti-ruido, almofadas de memory foam. Conforto maratono.",
    asin: "B00SAYCXWG",
    ml_id: null,
    loja_prioritaria: "amazon",
    categoria: "Audio",
    preco: 399.90,
    imagem_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
  },
  {
    slug: "cadeira-gamer-thunderx3",
    nome: "Cadeira Gamer ThunderX3",
    descricao: "Reclinavel ate 180, apoio lombar magnetico, rodas silenciosas. Carga ate 150kg.",
    asin: "B09ABC1234",
    ml_id: "MLB99998888",
    loja_prioritaria: "amazon",
    categoria: "Moveis",
    preco: 1899.00,
    imagem_url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80",
  },
  {
    slug: "notebook-gamer-acer-nitro",
    nome: "Notebook Gamer Acer Nitro 5",
    descricao: "Intel i5 11a, RTX 3050, 8GB RAM, SSD 256GB. Roda os principais jogos em Full HD.",
    asin: "B09XYZ1234",
    ml_id: "MLB55554444",
    loja_prioritaria: "ml",
    categoria: "Notebooks",
    preco: 4299.00,
    imagem_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
  },
  {
    slug: "controle-xbox-series-x",
    nome: "Controle Xbox Series X/S",
    descricao: "Wireless, gatilhos com textura, compativel com PC e Xbox. Disponibilidade nacional.",
    asin: "B08JVSBBB9",
    ml_id: "MLB11112222",
    loja_prioritaria: "ml",
    categoria: "Consoles",
    preco: 449.90,
    imagem_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
  },
  {
    slug: "playstation-5",
    nome: "PlayStation 5 Sony",
    descricao: "Console 8K, SSD ultra-rapido, controle DualSense com feedback haptico. Edicao God of Ragnarok.",
    asin: "B08JVSQ9YF",
    ml_id: "MLB33334444",
    loja_prioritaria: "amazon",
    categoria: "Consoles",
    preco: 4499.00,
    imagem_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
  },
];

export async function runSeed(db) {
  const stmts = [
    { sql: "DELETE FROM produtos" },
    ...PRODUTOS.map((p) => ({
      sql: "INSERT INTO produtos (slug, nome, descricao, asin, ml_id, loja_prioritaria, categoria, preco, imagem_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        p.slug,
        p.nome,
        p.descricao ?? null,
        p.asin,
        p.ml_id,
        p.loja_prioritaria,
        p.categoria ?? null,
        p.preco ?? null,
        p.imagem_url ?? null,
      ],
    })),
  ];
  await db.batch(stmts);
  return PRODUTOS.length;
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let db;
  try {
    db = (await import("./db.js")).default;
    const n = await runSeed(db);
    console.log(`Seed concluido: ${n} produtos inseridos`);
  } catch (e) {
    console.error("Erro no seed:", e.message);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}
