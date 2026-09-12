import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const products = [
  {
    company: "Autonics",
    model: "PR18-8DP",
    series: "PR Series",
    sensing: "8mm",
    ipRating: "IP67",
    tempRange: "-25°C to 70°C",
    output: "PNP NO",
    voltage: "12-24V DC",
    price: 780,
    moq: 50,
    leadTime: "2-3 weeks",
    warranty: "1 year",
    stock: 680,
    warehouse: "the city",
    advantages: "Best price-performance ratio in 18mm barrel category. Korean quality with Indian pricing. Wide voltage range. Fast response time 1ms.",
  },
  {
    company: "Pepperl+Fuchs",
    model: "NBB8-18GM50",
    series: "NB Series",
    sensing: "8mm",
    ipRating: "IP68",
    tempRange: "-25°C to 85°C",
    output: "PNP NO/NC",
    voltage: "10-30V DC",
    price: 920,
    moq: 25,
    leadTime: "1-2 weeks",
    warranty: "2 years",
    stock: 450,
    warehouse: "Mumbai",
    advantages: "German precision engineering. Dual output configurable. Superior EMC immunity. IP68 rated for harsh environments. Extended temp range.",
  },
  {
    company: "IFM Electronic",
    model: "IF5250",
    series: "IF Series",
    sensing: "5mm",
    ipRating: "IP67",
    tempRange: "-25°C to 80°C",
    output: "PNP NO",
    voltage: "10-36V DC",
    price: 850,
    moq: 30,
    leadTime: "3-4 weeks",
    warranty: "2 years",
    stock: 200,
    warehouse: "Delhi",
    advantages: "Integrated IO-Link. Real-time diagnostics. LED status indicators. Stainless steel housing. Industry 4.0 ready.",
  },
  {
    company: "Omron",
    model: "E3Z-D62",
    series: "E3Z Series",
    sensing: "1000mm",
    ipRating: "IP67",
    tempRange: "-25°C to 55°C",
    output: "NPN NO",
    voltage: "12-24V DC",
    price: 1100,
    moq: 20,
    leadTime: "2 weeks",
    warranty: "1 year",
    stock: 320,
    warehouse: "Chennai",
    advantages: "High-precision photoelectric sensing. Built-in amplifier. Easy alignment. Compact body. Ideal for packaging lines.",
  },
  {
    company: "Honeywell",
    model: "C7080",
    series: "C7000 Series",
    sensing: "N/A",
    ipRating: "IP54",
    tempRange: "-40°C to 150°C",
    output: "4-20mA",
    voltage: "24V DC",
    price: 3200,
    moq: 10,
    leadTime: "1 week",
    warranty: "3 years",
    stock: 75,
    warehouse: "the city",
    advantages: "Industrial-grade temperature sensor. Extreme range. NIST-traceable accuracy. Robust enclosure. UL/CSA certified.",
  },
];

console.log("Seeding products...");

const insert = db.prepare(`
  INSERT OR REPLACE INTO products (id, company, model, series, sensing, ipRating, tempRange, output, voltage,
    price, moq, leadTime, warranty, stock, warehouse, advantages)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  for (const p of products) {
    // Check if exists first
    const existing = db.prepare("SELECT id FROM products WHERE company = ? AND model = ?").get(p.company, p.model) as { id: string } | undefined;
    const id = existing?.id || genId();
    insert.run(id, p.company, p.model, p.series, p.sensing, p.ipRating, p.tempRange, p.output, p.voltage,
      p.price, p.moq, p.leadTime, p.warranty, p.stock, p.warehouse, p.advantages);
    console.log(`  ✓ ${p.company} ${p.model} (${p.warehouse}, stock: ${p.stock})`);
  }
});

tx();

const count = (db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number }).count;
console.log(`\nDone! ${count} products in database.`);
db.close();
