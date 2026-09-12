"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Search, Trash2, Building2, Cpu, Banknote,
  Sparkles, Loader2, Check, X, Download, ChevronRight,
  CheckCircle2, ArrowRight, RefreshCw
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";

interface CatalogProduct {
  id: string;
  company: string;
  model: string;
  series: string;
  sensing: string;
  ipRating: string;
  tempRange: string;
  output: string;
  voltage: string;
  price: number;
  moq: number;
  warranty: string;
  stock: number;
  warehouse: string;
  advantages: string;
}

type SearchType = "company" | "mpn" | "make";

// Phase of AI research flow
type ResearchPhase = "search" | "choose" | "results";

// Lightweight product choice returned from initial search
interface ProductChoice {
  name: string;
  model: string;
  category: string;
  description: string;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAIResearch, setShowAIResearch] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiSearchType, setAiSearchType] = useState<SearchType>("company");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<CatalogProduct[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  // Two-step flow state
  const [researchPhase, setResearchPhase] = useState<ResearchPhase>("search");
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([]);
  const [selectedChoices, setSelectedChoices] = useState<Set<string>>(new Set());
  const [choicesLoading, setChoicesLoading] = useState(false);

  const [form, setForm] = useState({
    company: "", model: "", series: "", sensing: "", ipRating: "", tempRange: "",
    output: "", voltage: "", price: 0, moq: 0, warranty: "",
    stock: 0, warehouse: "", advantages: "",
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      toast.error("Failed to load products");
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { const t = setTimeout(fetchProducts, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleAddProduct = async () => {
    if (!form.company || !form.model) { toast.error("Company and Model are required"); return; }
    try {
      const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success(`${form.company} ${form.model} added`);
      setShowAddForm(false);
      setForm({ company: "", model: "", series: "", sensing: "", ipRating: "", tempRange: "", output: "", voltage: "", price: 0, moq: 0, warranty: "", stock: 0, warehouse: "", advantages: "" });
      fetchProducts();
    } catch { toast.error("Failed to add product"); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      toast.success("Product removed");
      fetchProducts();
    } catch { toast.error("Failed to delete"); }
  };

  // Step 1: Search for product choices (company/make → shows product list to pick from)
  const handleSearchChoices = async () => {
    if (!aiQuery.trim()) return;

    // For MPN search, go directly to full research (no choices step needed)
    if (aiSearchType === "mpn") {
      handleFullResearch([{ name: aiQuery, model: aiQuery, category: "MPN Lookup", description: "" }]);
      return;
    }

    setChoicesLoading(true);
    setProductChoices([]);
    setSelectedChoices(new Set());
    setResearchPhase("choose");

    try {
      const res = await fetch("/api/products/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery, searchType: aiSearchType }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProductChoices(data.choices || []);
      if ((data.choices || []).length === 0) {
        toast("No products found. Try a different search.", { icon: "🔍" });
        setResearchPhase("search");
      }
    } catch {
      // Mock choices
      const mockChoices: ProductChoice[] = aiSearchType === "company"
        ? [
            { name: `${aiQuery} Inductive Proximity Sensors`, model: "PR series", category: "Proximity Sensor", description: "Standard cylindrical inductive proximity sensors, M8-M30" },
            { name: `${aiQuery} Photoelectric Sensors`, model: "BEN/BF series", category: "Photoelectric", description: "Diffuse, retro-reflective, and through-beam types" },
            { name: `${aiQuery} Fiber Optic Sensors`, model: "BF series", category: "Fiber Optic", description: "High precision fiber optic amplifier sensors" },
            { name: `${aiQuery} Temperature Controllers`, model: "TK/TC series", category: "Temperature", description: "PID temperature controllers for industrial processes" },
            { name: `${aiQuery} Rotary Encoders`, model: "E40/E50 series", category: "Encoder", description: "Incremental and absolute rotary encoders" },
            { name: `${aiQuery} Pressure Sensors`, model: "PSA/PSB series", category: "Pressure", description: "Digital pressure sensors for pneumatic applications" },
          ]
        : [
            { name: "Standard Inductive Type", model: "Various", category: aiQuery, description: "Standard cylindrical, M8 to M30, IP67" },
            { name: "Miniature Type", model: "Various", category: aiQuery, description: "Ultra-small form factor, M4 to M6.5" },
            { name: "High Temperature Type", model: "Various", category: aiQuery, description: "Operating range up to +120C" },
            { name: "Long Distance Type", model: "Various", category: aiQuery, description: "Extended sensing distance, 2x standard" },
            { name: "Washdown / IP69K Type", model: "Various", category: aiQuery, description: "Stainless steel, food & beverage grade" },
          ];
      setProductChoices(mockChoices);
    }
    setChoicesLoading(false);
  };

  // Step 2: Research selected products in detail
  const handleFullResearch = async (choices?: ProductChoice[]) => {
    const toResearch = choices || Array.from(selectedChoices).map((name) => productChoices.find((c) => c.name === name)!).filter(Boolean);
    if (toResearch.length === 0) { toast.error("Select at least one product type"); return; }

    setAiLoading(true);
    setAiResults([]);
    setResearchPhase("results");

    const query = toResearch.map((c) => `${c.name} (${c.model})`).join(", ");

    try {
      const res = await fetch("/api/products/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiSearchType === "mpn" ? aiQuery : `${aiQuery}: ${query}`, searchType: aiSearchType }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAiResults(data.products || []);
      toast.success(`Found ${(data.products || []).length} products`);
    } catch {
      toast.error("Research failed — try again");
      setResearchPhase("choose");
    }
    setAiLoading(false);
  };

  const handleSaveToDb = async (product: CatalogProduct) => {
    setSaving(product.model);
    try {
      const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) });
      if (!res.ok) throw new Error();
      toast.success(`${product.company} ${product.model} saved`);
      fetchProducts();
    } catch { toast.error("Failed to save"); }
    setSaving(null);
  };

  const handleSaveAll = async () => {
    for (const p of aiResults) {
      await handleSaveToDb(p as CatalogProduct);
    }
    toast.success(`All ${aiResults.length} products saved to catalog`);
  };

  const toggleChoice = (name: string) => {
    setSelectedChoices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const resetResearch = () => {
    setResearchPhase("search");
    setProductChoices([]);
    setSelectedChoices(new Set());
    setAiResults([]);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-200">
          <div className="px-8 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Product Catalog</h1>
              <p className="text-xs text-slate-400 mt-0.5">{products.length} products in your database</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAIResearch(!showAIResearch); setShowAddForm(false); resetResearch(); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/20">
                <Sparkles className="w-4 h-4" /> AI Research
              </button>
              <button onClick={() => { setShowAddForm(!showAddForm); setShowAIResearch(false); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 max-w-7xl mx-auto space-y-6">

          {/* ── AI RESEARCH PANEL (Two-Step Flow) ── */}
          <AnimatePresence>
            {showAIResearch && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">AI Product Research</h3>
                        <p className="text-xs text-slate-500">
                          {researchPhase === "search" ? "Search by company, MPN, or product type"
                           : researchPhase === "choose" ? "Select which products to research in detail"
                           : "Review and save products to your catalog"}
                        </p>
                      </div>
                    </div>
                    {researchPhase !== "search" && (
                      <button onClick={resetResearch} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-700 hover:bg-purple-50">
                        <RefreshCw className="w-3 h-3" /> New Search
                      </button>
                    )}
                  </div>

                  {/* Phase 1: Search Input */}
                  {researchPhase === "search" && (
                    <div className="flex gap-3">
                      <div className="flex bg-white rounded-lg border border-purple-200 p-0.5">
                        {([["company", "Company"], ["mpn", "MPN"], ["make", "Make/Type"]] as [SearchType, string][]).map(([type, label]) => (
                          <button key={type} onClick={() => setAiSearchType(type)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${aiSearchType === type ? "bg-purple-600 text-white" : "text-slate-500 hover:text-slate-700"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1">
                        <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchChoices()}
                          placeholder={aiSearchType === "company" ? "e.g. Autonics, Pepperl+Fuchs..." : aiSearchType === "mpn" ? "e.g. PR18-8DP, NBB8-18GM50..." : "e.g. Inductive proximity sensor..."}
                          className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-xl text-sm placeholder-slate-400 focus:border-purple-400 outline-none" />
                      </div>
                      <button onClick={handleSearchChoices} disabled={!aiQuery.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                        <Search className="w-4 h-4" /> Search
                      </button>
                    </div>
                  )}

                  {/* Phase 2: Product Choices */}
                  {researchPhase === "choose" && (
                    <>
                      {choicesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-purple-500 mr-3" />
                          <span className="text-sm text-purple-600">Finding product categories for {aiQuery}...</span>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white/70 rounded-xl p-3 flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-600">
                              Found <span className="text-purple-700 font-bold">{productChoices.length}</span> product types for <span className="font-bold text-slate-800">{aiQuery}</span>.
                              Select which ones to research:
                            </p>
                            <span className="text-xs text-purple-600 font-bold">{selectedChoices.size} selected</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {productChoices.map((choice) => {
                              const selected = selectedChoices.has(choice.name);
                              return (
                                <motion.button key={choice.name}
                                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                  onClick={() => toggleChoice(choice.name)}
                                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                                    selected ? "border-purple-400 bg-purple-50 shadow-md shadow-purple-500/10" : "border-slate-200 bg-white hover:border-purple-300"
                                  }`}>
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h4 className="text-sm font-bold text-slate-800">{choice.name}</h4>
                                      <p className="text-[10px] text-slate-400">{choice.model}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      selected ? "bg-purple-600 border-purple-600" : "border-slate-300"
                                    }`}>
                                      {selected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                  </div>
                                  <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-500 mb-1">{choice.category}</span>
                                  <p className="text-xs text-slate-500">{choice.description}</p>
                                </motion.button>
                              );
                            })}
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => { const all = new Set(productChoices.map((c) => c.name)); setSelectedChoices(all); }}
                              className="px-4 py-2 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-50">
                              Select All
                            </button>
                            <button onClick={() => handleFullResearch()} disabled={selectedChoices.size === 0}
                              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-lg shadow-purple-500/20">
                              <Sparkles className="w-4 h-4" /> Research Selected ({selectedChoices.size})
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Phase 3: Results */}
                  {researchPhase === "results" && (
                    <>
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <div className="relative mb-4">
                            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
                              <Sparkles className="w-7 h-7 text-purple-600" />
                            </div>
                            <motion.div className="absolute inset-0 rounded-full border-4 border-purple-400 border-t-transparent"
                              animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                          </div>
                          <p className="text-sm font-semibold text-purple-700">Researching product specifications...</p>
                          <p className="text-xs text-slate-400 mt-1">This will take a few seconds</p>
                        </div>
                      ) : aiResults.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-purple-700">{aiResults.length} products researched</p>
                            <button onClick={handleSaveAll} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                              <Download className="w-3.5 h-3.5" /> Save All to Catalog
                            </button>
                          </div>
                          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                            {aiResults.map((p, i) => (
                              <div key={i} className="bg-white rounded-xl border border-purple-100 p-4 hover:shadow-sm transition-all">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-sm font-bold text-slate-800">{p.company} {p.model}</h4>
                                      <span className="text-[10px] font-semibold text-slate-400">{p.series}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                      <span>Sensing: <span className="font-semibold text-slate-700">{p.sensing}</span></span>
                                      <span>IP: <span className="font-semibold text-slate-700">{p.ipRating}</span></span>
                                      <span>Output: <span className="font-semibold text-slate-700">{p.output}</span></span>
                                      <span>Temp: <span className="font-semibold text-slate-700">{p.tempRange}</span></span>
                                      <span>Voltage: <span className="font-semibold text-slate-700">{p.voltage}</span></span>
                                      <span className="font-bold text-emerald-600">Rs.{p.price}</span>
                                    </div>
                                    {p.advantages && <p className="text-[10px] text-slate-400 mt-1">{Array.isArray(p.advantages) ? (p.advantages as string[]).join(" · ") : p.advantages}</p>}
                                  </div>
                                  <button onClick={() => handleSaveToDb(p as CatalogProduct)} disabled={saving === p.model}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 disabled:opacity-50 shrink-0 ml-4">
                                    {saving === p.model ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                    Save
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-500">No results found</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── ADD PRODUCT FORM ── */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" /> Add Product Manually
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: "company", label: "Company *", ph: "e.g. Autonics" },
                      { key: "model", label: "Model *", ph: "e.g. PR18-8DP" },
                      { key: "series", label: "Series", ph: "e.g. PR series" },
                      { key: "sensing", label: "Sensing", ph: "e.g. 8 mm" },
                      { key: "ipRating", label: "IP Rating", ph: "e.g. IP67" },
                      { key: "tempRange", label: "Temp Range", ph: "e.g. -25 to +70C" },
                      { key: "output", label: "Output", ph: "e.g. PNP NO" },
                      { key: "voltage", label: "Voltage", ph: "e.g. 12-24 VDC" },
                      { key: "warranty", label: "Warranty", ph: "e.g. 36 months" },
                      { key: "warehouse", label: "Warehouse", ph: "e.g. the city" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{f.label}</label>
                        <input type="text" value={(form as Record<string, unknown>)[f.key] as string}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.ph}
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                      </div>
                    ))}
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Price (Rs.)</label>
                      <input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                        placeholder="780" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">MOQ</label>
                      <input type="number" value={form.moq || ""} onChange={(e) => setForm({ ...form, moq: parseInt(e.target.value) || 0 })}
                        placeholder="50" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" /></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Stock</label>
                      <input type="number" value={form.stock || ""} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                        placeholder="500" className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" /></div>
                  </div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase">Advantages</label>
                    <textarea value={form.advantages} onChange={(e) => setForm({ ...form, advantages: e.target.value })}
                      placeholder="Key selling points..." className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-16 resize-none outline-none focus:border-blue-400" /></div>
                  <div className="flex gap-2">
                    <button onClick={handleAddProduct} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                      <Check className="w-4 h-4" /> Save Product
                    </button>
                    <button onClick={() => setShowAddForm(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SEARCH ── */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by company, model, or series..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none" />
          </div>

          {/* ── PRODUCT TABLE ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-3" />
              <span className="text-sm text-slate-500">Loading catalog...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 flex flex-col items-center">
              <Package className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-400 mb-1">No products in catalog</h3>
              <p className="text-sm text-slate-300 mb-4">Add products manually or use AI Research to populate your catalog</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAIResearch(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200">
                  <Sparkles className="w-4 h-4" /> AI Research
                </button>
                <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200">
                  <Plus className="w-4 h-4" /> Add Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-500">{products.length} products in catalog</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">Model</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">Series</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">Sensing</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">IP</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase">Output</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase">Price</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold uppercase">Stock</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                        <td className="px-4 py-3 font-semibold text-slate-700">{p.company}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{p.model}</td>
                        <td className="px-4 py-3 text-slate-500">{p.series}</td>
                        <td className="px-4 py-3 text-slate-600">{p.sensing}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">{p.ipRating}</span></td>
                        <td className="px-4 py-3 text-slate-600">{p.output}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">Rs.{p.price}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{p.stock}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
