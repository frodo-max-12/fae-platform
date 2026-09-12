export const STEPS = [
  { number: 1, title: "Customer Email", subtitle: "Load or paste the customer inquiry", icon: "Mail" },
  { number: 2, title: "Requirements", subtitle: "Review extracted specifications", icon: "ScanSearch" },
  { number: 3, title: "Product & Compare", subtitle: "Match product and compare specs", icon: "Package" },
  { number: 4, title: "Email Draft", subtitle: "Review and edit the response", icon: "FileEdit" },
  { number: 5, title: "Send", subtitle: "Send to customer", icon: "Send" },
] as const;

export const VERDICT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MEETS: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  EXCEEDS: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  GAP: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  CLOSE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  COMPATIBLE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "APP-SAFE": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export const SAMPLE_EMAILS = [
  {
    id: "sample-1",
    from: "priya.sharma@automationcorp.in",
    subject: "Sensor requirement — packaging line",
    date: "2026-04-13T09:15:00Z",
    snippet: "We are installing a new automated packaging line at our local facility...",
    body: `Dear Sales Team,

We are installing a new automated packaging line at our local facility and need proximity sensors urgently.

Requirement:
- Type: Inductive proximity sensor
- Sensing distance: minimum 10 mm
- Protection: IP67 or higher (dusty and wet environment)
- Operating temperature: -20C to +85C
- Output: PNP, NO
- Supply voltage: 10-30 VDC
- Quantity: 500 units
- Target price: under Rs.850 per unit
- Delivery: within 4 weeks

We currently use SICK IM08-08BPS-ZC1 sensors on other lines.
If you have a compatible or better alternative, please advise with a full technical comparison.

Best regards,
Priya Sharma — Automation Corp India`,
  },
  {
    id: "sample-2",
    from: "amit.patel@precisionmfg.com",
    subject: "Photoelectric sensor quote needed",
    date: "2026-04-12T14:30:00Z",
    snippet: "We need photoelectric sensors for our conveyor detection system...",
    body: `Hi,

We need photoelectric sensors for our conveyor detection system at our Gujarat plant.

Specs needed:
- Type: Diffuse reflective photoelectric sensor
- Detection range: 100-500mm
- IP rating: IP65 minimum
- Output: NPN, NC
- Voltage: 24VDC
- Quantity: 200 units
- Budget: Rs.1200 per unit max
- Timeline: 3 weeks

Currently using Omron E3Z-D62 but looking for cost-effective alternative.

Thanks,
Amit Patel
Precision Manufacturing Ltd`,
  },
  {
    id: "sample-3",
    from: "deepak.verma@steelworks.in",
    subject: "Temperature sensor requirement for furnace monitoring",
    date: "2026-04-11T11:00:00Z",
    snippet: "We need high-temperature sensors for our steel furnace monitoring...",
    body: `Dear Team,

We are upgrading our furnace monitoring system and need temperature sensors.

Requirements:
- Type: K-type thermocouple
- Temperature range: 0 to 1200C
- Probe length: 300mm
- Protection: IP68 rated sheath
- Output: Standard K-type signal
- Accuracy: Class 1 (+-1.5C)
- Quantity: 50 units
- Price target: under Rs.3500/unit
- Delivery: 2 weeks urgent

Reference: We used Honeywell C7080 previously.

Regards,
Deepak Verma
SteelWorks India Pvt Ltd`,
  },
  {
    id: "sample-4",
    from: "rajesh.kumar@autoparts.in",
    subject: "Re: Re: Sensor requirements — multiple lines",
    date: "2026-04-14T08:00:00Z",
    snippet: "Adding one more requirement for Line 3. Also see below thread for Line 1 and 2...",
    body: `Hi Team,

Adding one more requirement for Line 3:
- Capacitive proximity sensor
- Sensing: 15mm
- IP67
- PNP NO, M18 housing
- 10-30VDC
- Qty: 300 units

Please include this along with Line 1 and Line 2 requirements below.

Rajesh Kumar

On Mon, 14 Apr 2026 at 07:15, Rajesh Kumar <rajesh.kumar@autoparts.in> wrote:

Hi,

For Line 2 we need:
| Parameter      | Value               |
|---------------|---------------------|
| Type          | Photoelectric sensor |
| Range         | 200mm               |
| IP Rating     | IP65                |
| Output        | NPN NC              |
| Voltage       | 24VDC               |
| Quantity      | 150 units           |
| Target Price  | Rs.1100/unit        |

Reference: Omron E3Z-D82

Thanks,
Rajesh

On Sun, 13 Apr 2026 at 16:40, Rajesh Kumar <rajesh.kumar@autoparts.in> wrote:

Dear Sales,

We are expanding our automotive parts manufacturing facility and need sensors for 3 production lines.

Line 1 requirement:
- Type: Inductive proximity sensor (M12 flush mount)
- Sensing distance: 4mm
- IP68 rated (wash-down area)
- Operating temp: -10C to +70C
- Output: PNP, NO, 3-wire
- Supply: 12-24VDC
- Housing: Stainless steel, M12 cylindrical
- Connector: M12, 4-pin
- Qty: 250 units
- Price target: under Rs.750 per unit
- Delivery: 3 weeks
- Reference: SICK IME12-04BPSZC0S

Best regards,
Rajesh Kumar
AutoParts India Pvt Ltd
the city, Maharashtra`,
  },
];
