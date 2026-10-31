/**
 * Telangana customers and places for the demo history: homes across
 * Hyderabad and the districts, plus a few small factories (commercial, with
 * GSTIN, no subsidy). A seeded PRNG keeps every run identical.
 */

/** mulberry32: small, fast, deterministic. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

export const FIRST_NAMES = [
  "Venkata Ramana", "Lakshmi", "Srinivas", "Padmavathi", "Ramesh", "Sujatha", "Anil", "Kavitha", "Prasad", "Swathi",
  "Naresh", "Sravani", "Mahender", "Bhavani", "Raju", "Anitha", "Krishna", "Madhavi", "Suresh", "Divya",
  "Ravinder", "Shobha", "Vijay", "Haritha", "Kiran", "Rajeshwari", "Sai Teja", "Pooja", "Harish", "Manjula",
  "Ashok", "Neha", "Mohan", "Rekha", "Narendra", "Sunitha", "Gopal", "Vani", "Jagadeesh", "Jyothi",
  "Rahul", "Aruna", "Satyanarayana", "Usha", "Praveen", "Saritha", "Chandrasekhar", "Hema", "Imran", "Farida",
] as const;

export const LAST_NAMES = [
  "Reddy", "Rao", "Goud", "Naidu", "Sharma", "Varma", "Chary", "Yadav", "Prasad", "Kumar",
  "Agarwal", "Gupta", "Shetty", "Raju", "Babu", "Murthy", "Chowdary", "Patel", "Khan", "Devi",
] as const;

export type Place = { city: string; district: string; pincode: string; areas: readonly string[] };

export const PLACES: readonly Place[] = [
  { city: "Kukatpally", district: "Medchal–Malkajgiri", pincode: "500072", areas: ["KPHB Colony Phase 3", "Vivekananda Nagar", "Allwyn Colony"] },
  { city: "Gachibowli", district: "Rangareddy", pincode: "500032", areas: ["Telecom Nagar", "Indira Nagar", "DLF Road"] },
  { city: "Madhapur", district: "Rangareddy", pincode: "500081", areas: ["Kavuri Hills", "Ayyappa Society", "Image Gardens Road"] },
  { city: "Miyapur", district: "Rangareddy", pincode: "500049", areas: ["Madinaguda", "Hafeezpet", "Deepthisri Nagar"] },
  { city: "LB Nagar", district: "Rangareddy", pincode: "500074", areas: ["Vanasthalipuram", "Hayathnagar Road", "Chintalkunta"] },
  { city: "Uppal", district: "Medchal–Malkajgiri", pincode: "500039", areas: ["Ramanthapur", "Habsiguda", "Nacharam"] },
  { city: "Secunderabad", district: "Hyderabad", pincode: "500003", areas: ["Marredpally", "Sainikpuri", "Alwal"] },
  { city: "Kompally", district: "Medchal–Malkajgiri", pincode: "500014", areas: ["Suchitra", "Pet Basheerabad", "Dulapally"] },
  { city: "Manikonda", district: "Rangareddy", pincode: "500089", areas: ["Puppalaguda", "Alkapur Township", "Neknampur"] },
  { city: "Dilsukhnagar", district: "Hyderabad", pincode: "500060", areas: ["Kothapet", "Chaitanyapuri", "Moosarambagh"] },
  { city: "Warangal", district: "Hanamkonda", pincode: "506002", areas: ["Hanamkonda", "Kazipet", "Subedari"] },
  { city: "Karimnagar", district: "Karimnagar", pincode: "505001", areas: ["Mukarampura", "Bhagathnagar", "Jyothinagar"] },
  { city: "Nizamabad", district: "Nizamabad", pincode: "503001", areas: ["Vinayak Nagar", "Pragathi Nagar", "Subhash Nagar"] },
  { city: "Khammam", district: "Khammam", pincode: "507001", areas: ["Wyra Road", "Gandhi Chowk", "Mamillagudem"] },
];

/** North Telangana is TSNPDCL; Hyderabad and the south are TSSPDCL. */
export const NORTH = new Set(["Warangal", "Karimnagar", "Nizamabad", "Khammam"]);

export const FACTORIES = [
  { name: "Sri Sai Polymers", gstin: "36AAKFS4421M1Z3", city: "Kompally" },
  { name: "Deccan Agro Foods", gstin: "36AAECD7712K1ZQ", city: "Uppal" },
  { name: "Balaji Steel Works", gstin: "36AAJFB2290P1Z8", city: "Miyapur" },
  { name: "Kakatiya Rice Mill", gstin: "36AAPFK6603L1Z1", city: "Warangal" },
] as const;

/** A unique, valid 10-digit mobile for seeded customer n. */
export function seededPhone(n: number): string {
  const lead = ["9", "8", "7", "6"][n % 4]!;
  return `${lead}${String(100_000_000 + ((n * 7_919_831) % 899_999_999)).padStart(9, "0")}`;
}
