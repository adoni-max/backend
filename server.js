const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: false });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('c:/Users/adony/Desktop/me'));

// --- SUPABASE CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Serve dashboard
app.get('/dashboard.html', (req, res) => {
  res.sendFile('c:/Users/adony/Desktop/me/sensor-dashboard.html');
});

// --- ENDPOINT: AI Proxy (Gemini) ---
app.post('/api/ai', async (req, res) => {
  console.log('🤖 POST /api/ai - Gemini request:', req.body.question?.substring(0, 50) + '...');
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY missing in .env' });
  }
  
  const context = req.body.context || 'No sensor data available';
  const question = req.body.question;
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert Agronomist for Addis Ababa farmers.
Sensor context: ${context}
Question: ${question}

Give short practical advice (2 sentences). Consider local climate/crops (teff, coffee, maize).`
          }]
        }]
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Gemini API error:', response.status, errText);
      return res.status(500).json({ error: 'Gemini API failed', details: errText });
    }
    
    const result = await response.json();
    const aiText = result.candidates[0]?.content?.parts[0]?.text || 'No response';
    
    console.log('✅ AI response generated');
    res.json({ response: aiText });
  } catch (error) {
    console.error('❌ AI proxy error:', error.message);
    res.status(500).json({ error: 'AI service unavailable. Check GEMINI_API_KEY and internet.' });
  }
});

// --- ENDPOINT: Fetch Latest Data ---
app.get('/api/latest', async (req, res) => {
    console.log('📥 GET /api/latest - Fetching latest sensor data...');
    const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('❌ Error fetching latest data:', error);
        return res.status(500).json({ message: 'Error could not fetch data', details: error });
    }
    if (!data || data.length === 0) {
        console.log('ℹ️ No latest data available in database');
        return res.json(null);
    }
    console.log('✅ Latest data received:', data[0] || 'no data');
    if (data[0] && data[0].sensor_type === 'temperature') {
      console.log('🌡️ Latest Temperature: ' + data[0].value + '°C');
    }
    res.json(data[0]);
});

// --- ENDPOINT: Fetch History (For Charts) ---
app.get('/api/history', async (req, res) => {
    console.log('📥 GET /api/history - Fetching sensor history...');
    const { data, error } = await supabase
        .from('sensor_data')
        .select('created_at, sensor_type, value')
        .order('created_at', { ascending: false })
        .limit(50); // Get the last 50 readings

    if (error) {
        console.error('❌ Error fetching history:', error);
        return res.status(500).json({ message: 'Error could not fetch data', details: error });
    }
    if (!data || data.length === 0) {
        console.log('ℹ️ No history data available in database');
        return res.json([]);
    }
    console.log(`✅ History data received: ${data.length} records`);
    const temps = data.filter(function(d) { return d.sensor_type === 'temperature'; }).slice(0, 3);
    if (temps.length > 0) {
      console.log('🔥 Recent Temperatures (' + temps.length + '): ' + temps.map(function(t) { return t.value + '°C'; }).join(', '));
    }
    res.json(data);
});

app.listen(port, () => {
    console.log(`AgriSense Backend running at http://localhost:${port}`);
    console.log('Dashboard: http://localhost:3000/dashboard.html');
});
