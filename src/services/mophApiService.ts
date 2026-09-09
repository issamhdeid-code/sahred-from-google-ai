const API_BASE = '';

export interface MOPHPriceRecord {
  MOHCode: string;
  RegistrationNumber: string;
  BrandName: string;
  BrandId: number;
  Strength: string;
  Presentation: string;
  Form: string;
  Agent: string;
  AgentId: number;
  Manufacturer: string;
  ManufacturerId: number;
  Country: string;
  CountryId: number;
  PublicPrice: number;
  PriceDate: string;
  GTIN: string;
  NeedPrescription: boolean;
  NeedPatientId: boolean;
  Stratum: string;
}

interface MOPHAuthResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export async function authenticateMOPH(username: string, password: string): Promise<MOPHAuthResult> {
  const response = await fetch(`${API_BASE}/api/moph/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Authentication failed (${response.status})`);
  }

  return response.json();
}

export async function fetchMOPHPriceCatalog(token: string): Promise<MOPHPriceRecord[]> {
  const response = await fetch(`${API_BASE}/api/moph/price-catalog`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch MOPH price catalog (${response.status})`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result : result ? [result] : [];
}

export function matchMedicationsToProducts(
  records: MOPHPriceRecord[],
  productCodes: Map<string, { id: string; code: string; priceLBP: number; priceUSD: number }>
) {
  const matched: Array<{
    mophData: MOPHPriceRecord;
    productId: string;
    productCode: string;
  }> = [];

  const codeSet = new Set<string>();
  productCodes.forEach((_, code) => codeSet.add(code.toUpperCase()));

  for (const rec of records) {
    if (rec.MOHCode && codeSet.has(rec.MOHCode.toUpperCase())) {
      matched.push({
        mophData: rec,
        productId: productCodes.get(rec.MOHCode.toUpperCase())!.id,
        productCode: rec.MOHCode.toUpperCase(),
      });
    }
  }

  return matched;
}

export interface MOPHPriceListRow {
  code: number | string;
  registrationNumber: string;
  brandName: string;
  strength: string;
  presentation: string;
  form: string;
  agent: string;
  manufacturer: string;
  country: string;
  publicPriceLBP: number | null;
  pharmacistMargin: number | null;
  stratum: string;
}

export async function fetchMOPHPriceList(): Promise<MOPHPriceListRow[]> {
  const response = await fetch(`${API_BASE}/api/moph/price-list`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch MOPH price list (${response.status})`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result : [];
}

export interface MOPHLNDDIngredientResult {
  name: string;
  dosage: string;
  form: string;
  ingredients: string;
}

export async function fetchMOPHLNDDIngredients(
  items: Array<{ name: string; dosage: string; form: string }>
): Promise<MOPHLNDDIngredientResult[]> {
  const response = await fetch(`${API_BASE}/api/moph/lndd-ingredients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch ingredients (${response.status})`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result : [];
}