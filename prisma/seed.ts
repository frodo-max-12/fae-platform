import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(import.meta.dirname || __dirname, "dev.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`DROP TABLE IF EXISTS products`);
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    model TEXT NOT NULL,
    series TEXT NOT NULL,
    sensing TEXT NOT NULL,
    ipRating TEXT NOT NULL,
    tempRange TEXT NOT NULL,
    output TEXT NOT NULL,
    voltage TEXT NOT NULL,
    price REAL NOT NULL,
    moq INTEGER NOT NULL,
    warranty TEXT NOT NULL,
    stock INTEGER NOT NULL,
    warehouse TEXT NOT NULL,
    advantages TEXT NOT NULL,
    UNIQUE(company, model)
  )
`);

// Wipe any legacy non-Company A brands so catalog reflects brochure only
db.exec(`DELETE FROM products`);

/**
 * Company A authorized dealer product lines — from brochure 2026.
 * Field mapping for mixed electronics catalog:
 *   sensing   = key electrical spec (e.g. "1A 1000V", "8-bit 64KB Flash", "7\" 800x480", "10A SPDT")
 *   ipRating  = package / form factor (e.g. "DO-41", "SOP-8", "LQFP-48", "PCB-mount")
 *   output    = output / configuration type
 *   voltage   = voltage rating / range
 */
const products = [
  // ─────────────── RECTRON (rectron.com) ───────────────
  // Bridge Rectifiers — RL / KBP / GBU
  { company: "Rectron", model: "RL201", series: "RL series (Bridge Rectifier)", sensing: "2A 50V", ipRating: "RL-34", tempRange: "-55C to +150C", output: "Single-phase bridge", voltage: "50V Vrrm", price: 8, moq: 1000, warranty: "12 months", stock: 5000, warehouse: "the city", advantages: "Low-cost bridge rec. High surge 60A. JEDEC registered." },
  { company: "Rectron", model: "RL207", series: "RL series (Bridge Rectifier)", sensing: "2A 1000V", ipRating: "RL-34", tempRange: "-55C to +150C", output: "Single-phase bridge", voltage: "1000V Vrrm", price: 11, moq: 1000, warranty: "12 months", stock: 4200, warehouse: "the city", advantages: "High voltage bridge for offline SMPS. 60A surge." },
  { company: "Rectron", model: "KBP210", series: "KBP series (Bridge Rectifier)", sensing: "2A 1000V", ipRating: "KBPM", tempRange: "-55C to +150C", output: "Single-phase bridge", voltage: "1000V Vrrm", price: 14, moq: 500, warranty: "12 months", stock: 2800, warehouse: "the city", advantages: "Flat KBPM package, PCB-friendly, LED drivers." },
  { company: "Rectron", model: "GBU808", series: "GBU series (Bridge Rectifier)", sensing: "8A 800V", ipRating: "GBU", tempRange: "-55C to +150C", output: "Single-phase bridge", voltage: "800V Vrrm", price: 28, moq: 200, warranty: "12 months", stock: 900, warehouse: "the city", advantages: "Through-hole GBU, used in 100W+ SMPS." },

  // Standard rectifiers — 1N series
  { company: "Rectron", model: "1N4007", series: "1N400x (Std Rectifier)", sensing: "1A 1000V", ipRating: "DO-41", tempRange: "-55C to +175C", output: "Axial lead", voltage: "1000V Vrrm", price: 1.2, moq: 5000, warranty: "12 months", stock: 50000, warehouse: "the city", advantages: "Industry-standard rectifier. Huge stock. Lowest cost." },
  { company: "Rectron", model: "1N5408", series: "1N540x (Std Rectifier)", sensing: "3A 1000V", ipRating: "DO-201AD", tempRange: "-55C to +175C", output: "Axial lead", voltage: "1000V Vrrm", price: 3.5, moq: 2000, warranty: "12 months", stock: 15000, warehouse: "the city", advantages: "3A rectifier for medium power SMPS." },

  // Schottky — SB / SS / 1N58xx
  { company: "Rectron", model: "SB560", series: "SB series (Schottky)", sensing: "5A 60V", ipRating: "DO-201AD", tempRange: "-55C to +125C", output: "Axial", voltage: "60V Vrrm", price: 9, moq: 1000, warranty: "12 months", stock: 6500, warehouse: "the city", advantages: "Low Vf 0.7V. Solar bypass diodes." },
  { company: "Rectron", model: "SS34", series: "SS-x series (SMD Schottky)", sensing: "3A 40V", ipRating: "SMA (DO-214AC)", tempRange: "-55C to +125C", output: "SMD", voltage: "40V Vrrm", price: 4.5, moq: 3000, warranty: "12 months", stock: 22000, warehouse: "the city", advantages: "Standard SMD Schottky. DC-DC output rectifier." },
  { company: "Rectron", model: "1N5822", series: "1N58xx (Schottky)", sensing: "3A 40V", ipRating: "DO-201AD", tempRange: "-55C to +125C", output: "Axial", voltage: "40V Vrrm", price: 6, moq: 2000, warranty: "12 months", stock: 12000, warehouse: "the city", advantages: "JEDEC Schottky. Buck converters." },

  // Fast recovery
  { company: "Rectron", model: "FR207", series: "FR series (Fast Recovery)", sensing: "2A 1000V trr 500ns", ipRating: "DO-15", tempRange: "-55C to +150C", output: "Axial", voltage: "1000V Vrrm", price: 3.2, moq: 2000, warranty: "12 months", stock: 10000, warehouse: "the city", advantages: "Fast recovery for SMPS secondary." },
  { company: "Rectron", model: "ES2D", series: "ES series (Super-Fast)", sensing: "2A 200V trr 35ns", ipRating: "SMB (DO-214AA)", tempRange: "-55C to +150C", output: "SMD", voltage: "200V Vrrm", price: 5, moq: 2500, warranty: "12 months", stock: 9000, warehouse: "the city", advantages: "Ultra-fast for high-freq SMPS." },

  // TVS / ESD
  { company: "Rectron", model: "SMAJ24A", series: "SMAJ series (TVS Unidirectional)", sensing: "400W 24V Vwm", ipRating: "SMA (DO-214AC)", tempRange: "-55C to +150C", output: "Uni-directional TVS", voltage: "24V Vwm / 38.9V Vbr", price: 3.5, moq: 3000, warranty: "12 months", stock: 18000, warehouse: "the city", advantages: "400W transient suppression. Automotive load-dump." },
  { company: "Rectron", model: "P6KE36A", series: "P6KE series (TVS)", sensing: "600W 36V Vwm", ipRating: "DO-15", tempRange: "-55C to +175C", output: "Uni-directional TVS", voltage: "36V Vwm / 50V Vbr", price: 7, moq: 1500, warranty: "12 months", stock: 5500, warehouse: "the city", advantages: "600W TVS for industrial surge protection." },
  { company: "Rectron", model: "ESDA6V1W5", series: "ESDAx series (ESD)", sensing: "6V 0.5pF", ipRating: "SOT-353", tempRange: "-55C to +150C", output: "Bidirectional ESD", voltage: "6V Vrwm", price: 2.8, moq: 5000, warranty: "12 months", stock: 14000, warehouse: "the city", advantages: "Ultra-low cap ESD for USB/HDMI lines." },

  // MOSFETs
  { company: "Rectron", model: "IRFZ44N", series: "IRFZxx (N-MOSFET TO-220)", sensing: "49A 55V Rds 17.5mΩ", ipRating: "TO-220", tempRange: "-55C to +175C", output: "N-channel", voltage: "55V Vds", price: 24, moq: 100, warranty: "12 months", stock: 3200, warehouse: "the city", advantages: "Industry staple MOSFET. Motor drive, inverters." },
  { company: "Rectron", model: "IRF540N", series: "IRF5xx (N-MOSFET TO-220)", sensing: "33A 100V Rds 44mΩ", ipRating: "TO-220", tempRange: "-55C to +175C", output: "N-channel", voltage: "100V Vds", price: 28, moq: 100, warranty: "12 months", stock: 2800, warehouse: "the city", advantages: "100V MOSFET for 48V systems." },

  // ─────────────── DIOTEC (diotec.com) ───────────────
  { company: "Diotec", model: "SK34", series: "SKxx (Schottky)", sensing: "3A 40V", ipRating: "SMA (DO-214AC)", tempRange: "-55C to +125C", output: "SMD", voltage: "40V Vrrm", price: 5, moq: 2500, warranty: "12 months", stock: 8500, warehouse: "Mumbai", advantages: "German-quality Schottky. AEC-Q101 qualified." },
  { company: "Diotec", model: "SK56", series: "SKxx (Schottky)", sensing: "5A 60V", ipRating: "DO-201AD", tempRange: "-55C to +125C", output: "Axial", voltage: "60V Vrrm", price: 11, moq: 1000, warranty: "12 months", stock: 4200, warehouse: "Mumbai", advantages: "Low Vf 0.7V. Automotive qualified." },
  { company: "Diotec", model: "SK1045", series: "SKxx (Schottky Dual)", sensing: "10A 45V", ipRating: "TO-220AB", tempRange: "-55C to +150C", output: "Common-cathode dual", voltage: "45V Vrrm", price: 42, moq: 200, warranty: "12 months", stock: 950, warehouse: "Mumbai", advantages: "Dual Schottky for synchronous rectifier stage." },
  { company: "Diotec", model: "D1SC06", series: "SiC Schottky", sensing: "1A 600V SiC", ipRating: "TO-220AC", tempRange: "-55C to +175C", output: "SiC Schottky", voltage: "600V Vrrm", price: 95, moq: 100, warranty: "12 months", stock: 450, warehouse: "Mumbai", advantages: "Zero reverse recovery. PFC boost stage, solar." },
  { company: "Diotec", model: "BZX55C5V1", series: "BZX55C (Zener)", sensing: "5.1V 500mW", ipRating: "DO-35", tempRange: "-55C to +150C", output: "Zener", voltage: "5.1V Vz", price: 1.5, moq: 5000, warranty: "12 months", stock: 22000, warehouse: "Mumbai", advantages: "Standard Zener for reference/clamping." },
  { company: "Diotec", model: "BZX85C12", series: "BZX85C (Zener 1.3W)", sensing: "12V 1.3W", ipRating: "DO-41", tempRange: "-55C to +150C", output: "Zener", voltage: "12V Vz", price: 3, moq: 3000, warranty: "12 months", stock: 14000, warehouse: "Mumbai", advantages: "1.3W Zener for regulators and surge protection." },
  { company: "Diotec", model: "BC547", series: "BC5xx (NPN BJT)", sensing: "NPN 100mA hFE 110-800", ipRating: "TO-92", tempRange: "-55C to +150C", output: "NPN transistor", voltage: "45V Vce", price: 1.2, moq: 5000, warranty: "12 months", stock: 32000, warehouse: "Mumbai", advantages: "Universal small-signal NPN. Teaching labs, switching." },
  { company: "Diotec", model: "BC557", series: "BC5xx (PNP BJT)", sensing: "PNP 100mA hFE 125-800", ipRating: "TO-92", tempRange: "-55C to +150C", output: "PNP transistor", voltage: "45V Vce", price: 1.2, moq: 5000, warranty: "12 months", stock: 28000, warehouse: "Mumbai", advantages: "Complement to BC547. High-side switching." },
  { company: "Diotec", model: "BD139", series: "BDxx (Medium Power NPN)", sensing: "1.5A hFE 40-250", ipRating: "TO-126", tempRange: "-55C to +150C", output: "NPN transistor", voltage: "80V Vceo", price: 4.5, moq: 1500, warranty: "12 months", stock: 6500, warehouse: "Mumbai", advantages: "Audio and low-power driver stage." },

  // ─────────────── NEXGEN POWER (SiC) ───────────────
  { company: "NexGen Power", model: "NGS065N065SJP", series: "NGS SiC MOSFET 650V", sensing: "50A 650V Rds 65mΩ SiC", ipRating: "TO-247-3", tempRange: "-55C to +175C", output: "N-channel SiC MOSFET", voltage: "650V Vds", price: 650, moq: 25, warranty: "18 months", stock: 180, warehouse: "Delhi", advantages: "SiC MOSFET, low switching loss, EV chargers, PFC." },
  { company: "NexGen Power", model: "NGS040N065SJP", series: "NGS SiC MOSFET 650V", sensing: "75A 650V Rds 40mΩ SiC", ipRating: "TO-247-3", tempRange: "-55C to +175C", output: "N-channel SiC MOSFET", voltage: "650V Vds", price: 890, moq: 20, warranty: "18 months", stock: 120, warehouse: "Delhi", advantages: "Lower Rds SiC for 11kW+ chargers." },
  { company: "NexGen Power", model: "NGD18N40G", series: "NGD IGBT 400V", sensing: "18A 400V Vce(sat) 1.8V", ipRating: "TO-220AB", tempRange: "-55C to +175C", output: "N-channel IGBT", voltage: "400V Vces", price: 180, moq: 50, warranty: "12 months", stock: 380, warehouse: "Delhi", advantages: "IGBT for induction cookers, welders." },
  { company: "NexGen Power", model: "NGD40N65G", series: "NGD Super-Junction IGBT 650V", sensing: "40A 650V Vce(sat) 1.6V", ipRating: "TO-247", tempRange: "-55C to +175C", output: "N-channel IGBT", voltage: "650V Vces", price: 420, moq: 20, warranty: "12 months", stock: 150, warehouse: "Delhi", advantages: "Hybrid IGBT for motor drives up to 5kW." },

  // ─────────────── MEGAWIN (megawin.com) — MCU ───────────────
  { company: "Megawin", model: "MG82F6D16", series: "MG82F 8-bit 1T 8051", sensing: "8-bit 1T 8051 16KB Flash 768B RAM", ipRating: "LQFP-44", tempRange: "-40C to +85C", output: "UART, SPI, I2C, 10-bit ADC", voltage: "2.4-5.5V", price: 65, moq: 100, warranty: "24 months", stock: 1800, warehouse: "Chennai", advantages: "1T 8051 MCU. Drop-in STC replacement. 24MHz." },
  { company: "Megawin", model: "MG82FG5A64", series: "MG82FG 8-bit 8051 w/ LCD", sensing: "8-bit 8051 64KB Flash 2KB RAM", ipRating: "LQFP-80", tempRange: "-40C to +85C", output: "LCD drv, 12-bit ADC, 16-bit PWM", voltage: "2.4-5.5V", price: 120, moq: 50, warranty: "24 months", stock: 900, warehouse: "Chennai", advantages: "Built-in LCD driver for meters, display panels." },
  { company: "Megawin", model: "MG82L516", series: "MG82L Low-Voltage 8051", sensing: "8-bit 8051 16KB Flash 512B RAM", ipRating: "SOP-28", tempRange: "-40C to +85C", output: "UART, SPI, I2C", voltage: "1.8-3.6V", price: 55, moq: 200, warranty: "24 months", stock: 2400, warehouse: "Chennai", advantages: "Low-voltage 8051. Battery-powered IoT nodes." },
  { company: "Megawin", model: "MG32F02A128", series: "MG32F02 ARM Cortex-M0+", sensing: "32-bit M0+ 128KB Flash 16KB SRAM", ipRating: "LQFP-64", tempRange: "-40C to +85C", output: "USB, CAN, UART, SPI, I2C, 12-bit ADC/DAC", voltage: "2.0-5.5V", price: 195, moq: 50, warranty: "24 months", stock: 550, warehouse: "Chennai", advantages: "ARM M0+ at 48MHz. USB & CAN built-in." },
  { company: "Megawin", model: "MG32F02U128", series: "MG32F02U USB Cortex-M0+", sensing: "32-bit M0+ 128KB Flash 16KB SRAM USB", ipRating: "LQFP-48", tempRange: "-40C to +85C", output: "USB FS device, UART, SPI, I2C", voltage: "2.0-5.5V", price: 210, moq: 50, warranty: "24 months", stock: 380, warehouse: "Chennai", advantages: "USB Full-Speed device built-in. HID/CDC apps." },

  // ─────────────── CXW (cxwic.net) — Power ICs ───────────────
  { company: "CXW", model: "CX8836", series: "CX88xx USB PD Controller", sensing: "USB PD 3.0 PPS 100W", ipRating: "QFN-24", tempRange: "-40C to +105C", output: "USB-C PD source/sink", voltage: "3.3-24V", price: 85, moq: 100, warranty: "12 months", stock: 1200, warehouse: "Mumbai", advantages: "PD3.0 PPS, 100W chargers, GaN-ready." },
  { company: "CXW", model: "CX8606", series: "CX86xx DC/DC Buck", sensing: "6A 28V Buck, 600kHz", ipRating: "SOP-8 EP", tempRange: "-40C to +125C", output: "Sync buck converter", voltage: "4.5-28V in / 0.8-24V out", price: 32, moq: 500, warranty: "12 months", stock: 3600, warehouse: "Mumbai", advantages: "6A synchronous buck. Low BOM, small footprint." },
  { company: "CXW", model: "CX8510", series: "CX85xx DC/DC Buck", sensing: "1A 40V Buck", ipRating: "SOT-23-6", tempRange: "-40C to +85C", output: "Buck converter", voltage: "4.5-40V in", price: 14, moq: 1000, warranty: "12 months", stock: 8000, warehouse: "Mumbai", advantages: "Wide Vin, low-cost POL, industrial." },
  { company: "CXW", model: "CX6207", series: "CX62xx Low-Iq LDO", sensing: "300mA Iq 1µA", ipRating: "SOT-23-5", tempRange: "-40C to +85C", output: "Linear regulator", voltage: "2.5-6V in / adj out", price: 7, moq: 2000, warranty: "12 months", stock: 12000, warehouse: "Mumbai", advantages: "Ultra-low quiescent current for battery apps." },
  { company: "CXW", model: "CX9801", series: "CX98xx Li-Ion Charger", sensing: "1A Li-Ion 4.2V CC/CV", ipRating: "SOP-8", tempRange: "-40C to +85C", output: "Battery charger", voltage: "5V USB input", price: 18, moq: 1000, warranty: "12 months", stock: 6500, warehouse: "Mumbai", advantages: "TP4056-compatible, USB Li-ion charger." },

  // ─────────────── NOVOSENS (novosns.com) ───────────────
  { company: "Novosens", model: "NCA1042", series: "NCAxxxx CAN Transceiver", sensing: "CAN 2.0B 5Mbps", ipRating: "SOP-8", tempRange: "-40C to +125C", output: "CAN high-speed", voltage: "4.5-5.5V", price: 55, moq: 500, warranty: "12 months", stock: 2400, warehouse: "the city", advantages: "TJA1042-equivalent CAN transceiver. Automotive." },
  { company: "Novosens", model: "NCA1051", series: "NCAxxxx CAN FD Transceiver", sensing: "CAN FD 5Mbps", ipRating: "SOP-8", tempRange: "-40C to +150C", output: "CAN FD", voltage: "4.5-5.5V", price: 75, moq: 500, warranty: "12 months", stock: 1800, warehouse: "the city", advantages: "CAN FD for modern ECUs. AEC-Q100." },
  { company: "Novosens", model: "NSV1117-3.3", series: "NSV1117 LDO", sensing: "1A LDO 3.3V fixed", ipRating: "SOT-223", tempRange: "-40C to +125C", output: "Linear regulator 3.3V", voltage: "4.75-15V in", price: 9, moq: 1000, warranty: "12 months", stock: 9000, warehouse: "the city", advantages: "AMS1117-equivalent LDO. Workhorse 3.3V rail." },
  { company: "Novosens", model: "NSA2100", series: "NSA Op-Amp", sensing: "Dual op-amp 1MHz", ipRating: "SOIC-8", tempRange: "-40C to +125C", output: "Op-amp", voltage: "3-36V", price: 12, moq: 1000, warranty: "12 months", stock: 5500, warehouse: "the city", advantages: "LM358-equivalent dual op-amp. Sensor conditioning." },
  { company: "Novosens", model: "NSG2121", series: "NSG Gate Driver", sensing: "Half-bridge driver 2A peak", ipRating: "SOIC-8", tempRange: "-40C to +125C", output: "Half-bridge MOSFET driver", voltage: "10-20V Vcc", price: 48, moq: 500, warranty: "12 months", stock: 1800, warehouse: "the city", advantages: "IR2110-equivalent, motor drive and inverter." },
  { company: "Novosens", model: "NSP1000-1B", series: "NSP Pressure Sensor", sensing: "0-1 bar analog pressure", ipRating: "DIP ported", tempRange: "-40C to +125C", output: "Analog 0.5-4.5V", voltage: "5V", price: 380, moq: 50, warranty: "12 months", stock: 250, warehouse: "the city", advantages: "Piezoresistive pressure sensor for HVAC/hydraulics." },

  // ─────────────── SONYTEK (sonytek.com) — Displays ───────────────
  { company: "Sonytek", model: "ST035AT10N-CTP", series: "ST TFT 3.5\"", sensing: "3.5\" TFT 320x480 CTP", ipRating: "FPC-40pin", tempRange: "-20C to +70C", output: "RGB 24-bit + I2C CTP", voltage: "3.3V", price: 620, moq: 50, warranty: "12 months", stock: 380, warehouse: "Chennai", advantages: "3.5\" TFT with capacitive touch, IoT HMI." },
  { company: "Sonytek", model: "ST050AT10N-RTP", series: "ST TFT 5\"", sensing: "5\" TFT 800x480 RTP", ipRating: "FPC-40pin", tempRange: "-20C to +70C", output: "RGB 24-bit + resistive 4-wire", voltage: "3.3V", price: 890, moq: 30, warranty: "12 months", stock: 260, warehouse: "Chennai", advantages: "5\" display with resistive touch. Industrial panels." },
  { company: "Sonytek", model: "ST070AT10N-CTP", series: "ST TFT 7\"", sensing: "7\" TFT 1024x600 CTP", ipRating: "FPC-50pin", tempRange: "-20C to +70C", output: "LVDS + I2C CTP", voltage: "3.3V / 12V LED", price: 1850, moq: 20, warranty: "12 months", stock: 140, warehouse: "Chennai", advantages: "7\" LVDS with PCAP touch. POS/kiosk." },
  { company: "Sonytek", model: "ST101AT10N-CTP", series: "ST TFT 10.1\"", sensing: "10.1\" TFT 1280x800 CTP", ipRating: "FPC-50pin", tempRange: "-20C to +70C", output: "LVDS + I2C CTP", voltage: "3.3V / 12V LED", price: 3600, moq: 10, warranty: "12 months", stock: 70, warehouse: "Chennai", advantages: "10.1\" HD panel for industrial HMIs." },
  { company: "Sonytek", model: "SPT1602A", series: "Char LCD 16x2", sensing: "16x2 character STN", ipRating: "PCB module 80x36mm", tempRange: "-20C to +70C", output: "HD44780 parallel/I2C", voltage: "5V", price: 180, moq: 100, warranty: "12 months", stock: 900, warehouse: "Chennai", advantages: "Classic 1602 LCD. Prototyping, meters." },

  // ─────────────── DWIN (dwin-global.com) — HMI Displays ───────────────
  { company: "DWIN", model: "DMG80480C043_03W", series: "DWIN T5L Smart 4.3\"", sensing: "4.3\" 480x272 T5L CPU", ipRating: "PCB mount 121x76mm", tempRange: "-20C to +70C", output: "UART HMI serial", voltage: "5V", price: 2400, moq: 10, warranty: "12 months", stock: 95, warehouse: "Mumbai", advantages: "T5L ASIC HMI, DGUS editor, standalone UI." },
  { company: "DWIN", model: "DMG80480T050_02W", series: "DWIN T5L Smart 5\"", sensing: "5\" 800x480 T5L RTP", ipRating: "PCB mount 136x100mm", tempRange: "-20C to +70C", output: "UART HMI + resistive touch", voltage: "5V", price: 3100, moq: 10, warranty: "12 months", stock: 80, warehouse: "Mumbai", advantages: "5\" HMI with resistive touch. No external MCU needed." },
  { company: "DWIN", model: "DMG80480T070_03W", series: "DWIN T5L Smart 7\"", sensing: "7\" 800x480 T5L CTP", ipRating: "PCB mount 165x100mm", tempRange: "-20C to +70C", output: "UART HMI + capacitive touch", voltage: "5V", price: 4200, moq: 10, warranty: "12 months", stock: 65, warehouse: "Mumbai", advantages: "7\" PCAP HMI. Most popular DWIN size. DGUS." },
  { company: "DWIN", model: "DMG10600T101_01W", series: "DWIN T5L Industrial 10.1\"", sensing: "10.1\" 1024x600 T5L CTP", ipRating: "IP65 front bezel", tempRange: "-20C to +70C", output: "UART HMI + CTP + RS485", voltage: "12V", price: 8900, moq: 5, warranty: "18 months", stock: 25, warehouse: "Mumbai", advantages: "Industrial IP65 10.1\" HMI. PLC replacement." },
  { company: "DWIN", model: "DMG10768T150_01W", series: "DWIN Android 15\"", sensing: "15\" 1024x768 Android HMI", ipRating: "Bezel mount 360x293mm", tempRange: "0C to +60C", output: "HDMI + USB + Ethernet", voltage: "12V", price: 22500, moq: 2, warranty: "18 months", stock: 8, warehouse: "Mumbai", advantages: "Android HMI, full GUI apps. Kiosk/medical." },

  // ─────────────── HONGFA (hongfa.com) — Relays ───────────────
  { company: "Hongfa", model: "HF41F-12-ZS", series: "HF41F Subminiature PCB Relay", sensing: "6A 250VAC SPDT", ipRating: "Through-hole PCB", tempRange: "-40C to +85C", output: "SPDT Form C", voltage: "12VDC coil", price: 22, moq: 500, warranty: "24 months", stock: 8500, warehouse: "the city", advantages: "6A PCB relay, industry-standard pinout. Control boards." },
  { company: "Hongfa", model: "HF32FA-005-ZS", series: "HF32FA Signal Relay", sensing: "1A 30VDC signal", ipRating: "Through-hole PCB", tempRange: "-40C to +85C", output: "SPDT", voltage: "5VDC coil", price: 28, moq: 500, warranty: "24 months", stock: 4200, warehouse: "the city", advantages: "Low-profile signal relay. Telecom, security panels." },
  { company: "Hongfa", model: "HF46F-G-24-HS1", series: "HF46F PCB Relay", sensing: "10A 277VAC SPST-NO", ipRating: "PCB through-hole", tempRange: "-40C to +85C", output: "SPST-NO", voltage: "24VDC coil", price: 35, moq: 500, warranty: "24 months", stock: 3800, warehouse: "the city", advantages: "10A industrial PCB relay. AC-motor switching." },
  { company: "Hongfa", model: "HF115F-012-1ZS3A", series: "HF115F Power Relay", sensing: "16A 250VAC SPDT", ipRating: "PCB/flange mount", tempRange: "-40C to +85C", output: "SPDT Form C", voltage: "12VDC coil", price: 58, moq: 200, warranty: "24 months", stock: 2200, warehouse: "the city", advantages: "16A power relay. Heater, AC, EV chargers." },
  { company: "Hongfa", model: "HF152F-T-024-1HST", series: "HF152F High-Current Relay", sensing: "30A 250VAC SPST-NO", ipRating: "PCB heavy-terminal", tempRange: "-40C to +85C", output: "SPST-NO", voltage: "24VDC coil", price: 145, moq: 100, warranty: "24 months", stock: 800, warehouse: "the city", advantages: "30A single-pole for e-mobility, solar inverters." },
  { company: "Hongfa", model: "HFE10-1-12-HT-L2", series: "HFE10 EV Contactor Latching", sensing: "100A 450VDC latching", ipRating: "M5 bolt terminals", tempRange: "-40C to +85C", output: "SPST latching", voltage: "12V pulse coil", price: 980, moq: 20, warranty: "24 months", stock: 140, warehouse: "the city", advantages: "100A EV latching contactor. BMS, DC charging." },
  { company: "Hongfa", model: "HFV4-006-ZST", series: "HFV4 Automotive Relay", sensing: "40A 14VDC SPDT auto", ipRating: "ISO 280 footprint", tempRange: "-40C to +105C", output: "SPDT", voltage: "12VDC coil", price: 42, moq: 500, warranty: "24 months", stock: 2600, warehouse: "the city", advantages: "Auto relay, ISO footprint. AEC-Q200." },
  { company: "Hongfa", model: "HFS12-005-1H", series: "HFS Solid State Relay", sensing: "2A 60VDC SSR", ipRating: "DIP-8", tempRange: "-40C to +85C", output: "SSR NO", voltage: "5VDC input", price: 180, moq: 100, warranty: "12 months", stock: 420, warehouse: "the city", advantages: "DC SSR, zero bounce, long life." },
  { company: "Hongfa", model: "HFKW-400-S", series: "HFKW Current Sensor", sensing: "400A AC/DC Hall sensor", ipRating: "Bus-bar through-hole", tempRange: "-40C to +85C", output: "Analog 0-5V / 4-20mA", voltage: "12-24V", price: 650, moq: 50, warranty: "18 months", stock: 180, warehouse: "the city", advantages: "Open-loop Hall current sensor for EV, solar." },
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO products (id, company, model, series, sensing, ipRating, tempRange, output, voltage, price, moq, warranty, stock, warehouse, advantages)
  VALUES (@id, @company, @model, @series, @sensing, @ipRating, @tempRange, @output, @voltage, @price, @moq, @warranty, @stock, @warehouse, @advantages)
`);

console.log("Seeding database with Company A brochure product lines...\n");

const insertMany = db.transaction((items: typeof products) => {
  for (const item of items) {
    const id = item.company.toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + item.model.toLowerCase().replace(/[^a-z0-9]/g, "");
    insert.run({ id, ...item });
    console.log(`  ${item.company.padEnd(14)} ${item.model.padEnd(22)} ${item.series}`);
  }
});

insertMany(products);

// Summary per brand
const brands = [...new Set(products.map((p) => p.company))];
console.log(`\nSeeded ${products.length} products from ${brands.length} Company A brochure brands:`);
for (const b of brands) {
  const n = products.filter((p) => p.company === b).length;
  console.log(`  ${b.padEnd(14)} → ${n} products`);
}
db.close();
