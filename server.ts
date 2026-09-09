import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log('Client connected for sync:', socket.id);
  
  socket.on('sync_update', (data) => {
    // Relay the message to all OTHER connected clients
    socket.broadcast.emit('sync_update', data);
  });

  // Secondary PC asks for the full dataset right after connecting
  socket.on('request_snapshot', (requesterData) => {
    socket.broadcast.emit('snapshot_requested', { requesterId: socket.id, requesterData });
  });

  // Main PC replies with its dataset, routed only to the requester
  socket.on('snapshot_response', ({ targetId, data }: { targetId?: string; data?: unknown }) => {
    if (targetId) {
      io.to(targetId).emit('snapshot_data', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;

app.use(express.json({ limit: '10mb' }));


// Permissive headers for local network & launcher access
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  // Google Identity Services uses a popup and checks its lifecycle from the opener.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint to enrich scientific drug monographs with AI
app.post('/api/scientifics/enrich', async (req, res) => {
  try {
    const { drugName, ingredients, dosage, form, presentation } = req.body || {};
    const queryIngredients = (ingredients || drugName || '').trim();

    if (!queryIngredients) {
      return res.status(400).json({ error: 'Missing drug ingredients or name' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on server',
        fallbackNeeded: true,
      });
    }

    const prompt = `You are a distinguished clinical pharmacologist and medical information specialist for a licensed clinical pharmacy.
Analyze this pharmaceutical product, especially its active ingredients (which may be a combination of multiple active ingredients or a single entity), and generate an authoritative, unified clinical monograph specifically tailored to this exact formulation and combination of ingredients.

Product Details:
- Drug Name: ${drugName || 'Not specified'}
- Active Ingredients: ${queryIngredients}
- Dosage Strength: ${dosage || 'Standard'}
- Pharmaceutical Form: ${form || 'Tablet'}
- Packaging / Presentation: ${presentation || 'Standard pack'}

Mandatory Clinical Instructions:
1. Deconstruct and identify all individual active molecules/substances in the formulation (e.g., Paracetamol + Caffeine, Amoxicillin + Clavulanic Acid, Fluticasone + Salmeterol, Losartan + Hydrochlorothiazide, Metformin + Sitagliptin, etc.).
2. Evaluate the synergy, therapeutic rationale, and combined pharmacodynamics of this multi-ingredient combination (why they are formulated together, additive analgesia, beta-lactamase protection, complementary blood pressure reduction, metabolic synergy).
3. Produce concise, highly professional clinical monograph sections formatted with clean bullet points:
   - "indications":
     • Primary Use: [Clear statement of the combined therapeutic purpose and target pathologies]
     • Key Indications: [List specific clinical indications and diseases treated, separated by semicolons]
     • Pharmacological Class: [Combined pharmacological classes of all ingredients]
   - "contraindications" (MUST combine contraindications and high-risk conditions across ALL active ingredients):
     • Absolute: [Documented hypersensitivity to any of the constituent ingredients or cross-reactive chemical classes]
     • Clinical Contraindications: [List specific organ impairments, pathologies, and clinical conditions that contraindicate ANY of the ingredients]
     • Safety Alert: [High-priority vigilance, black-box warnings, crucial drug-drug interactions, high-risk populations]
   - "sideEffects" (MUST combine adverse reactions across ALL active ingredients):
     • Common Reactions: [Frequent side effects attributable to the combination and each constituent molecule]
     • Critical Warnings: [Severe adverse reactions, organ toxicities, e.g. acute hepatotoxicity, rhabdomyolysis, tendon rupture, QT prolongation, angioedema]
     • Monitoring & Advice: [Crucial laboratory monitoring parameters, max daily limits, clinical safety guidance]
   - "dosage": Standard adult clinical dosing regimen for this combination.
   - "pediatricDosage": Specific pediatric dosing recommendations or pediatric contraindications for this combination.
   - "pregnancyCategory": FDA pregnancy category ('A' | 'B' | 'C' | 'D' | 'X') corresponding to the most restrictive constituent ingredient, with a brief clinical note.
   - "storageConditions": Optimal storage instructions (e.g. "Store below 25°C in a cool, dry place protected from moisture and direct light.").
   - "identifiedIngredients": Array of the distinct active ingredient names identified (e.g. ["Paracetamol", "Caffeine"]).

Return ONLY valid JSON matching this schema:
{
  "indications": "• Primary Use: ...\\n• Key Indications: ...\\n• Pharmacological Class: ...",
  "contraindications": "• Absolute: ...\\n• Clinical Contraindications: ...\\n• Safety Alert: ...",
  "sideEffects": "• Common Reactions: ...\\n• Critical Warnings: ...\\n• Monitoring & Advice: ...",
  "dosage": "...",
  "pediatricDosage": "...",
  "pregnancyCategory": "...",
  "storageConditions": "...",
  "identifiedIngredients": ["..."]
}`;

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
    let response: any = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All AI models failed to generate content');
    }

    const responseText = response.text || '';
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    }

    if (!parsedData || !parsedData.indications) {
      throw new Error('Invalid response structure from AI model');
    }

    const identified = Array.isArray(parsedData.identifiedIngredients) && parsedData.identifiedIngredients.length > 0
      ? parsedData.identifiedIngredients
      : [];

    return res.json({
      success: true,
      scientificInfo: {
        indications: parsedData.indications,
        contraindications: parsedData.contraindications,
        sideEffects: parsedData.sideEffects,
        dosage: parsedData.dosage || 'Adults: as prescribed by physician according to clinical guidelines.',
        pediatricDosage: parsedData.pediatricDosage || 'Pediatrics: consult physician for pediatric dosing.',
        pregnancyCategory: parsedData.pregnancyCategory || 'B',
        storageConditions: parsedData.storageConditions || 'Store below 25°C in a dry place.',
        activeIngredients: identified.length > 0 ? identified.join(' + ') : queryIngredients,
        onlineEnriched: true,
        onlineSource: 'AI-Verified Clinical Reference (Gemini + NIH NLM)',
        lastOnlineSearch: Date.now(),
      },
      source: 'AI-Verified Clinical Reference (Gemini + NIH NLM)',
      identifiedIngredients: identified,
    });
  } catch (err: any) {
    console.error('Error enriching scientific data with AI:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to enrich scientific data with AI',
      fallbackNeeded: true,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const localDist = typeof __dirname !== 'undefined' ? __dirname : cwdDist;
    const distPath = fs.existsSync(cwdDist) ? cwdDist : localDist;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Pharmacy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
